import { NextResponse } from "next/server";

import { getSourcingOrderById, saveSourcingOrder } from "@/lib/sourcing-store";
import { launchSourcingSupplierPaymentForOrder, repairBlockedSourcingOrderForSupplierPayment } from "@/lib/sourcing-batch-service";
import { getSourcingOrderMeta, resolveSourcingDeliveryPlan, withSourcingOrderMeta, type SourcingDeliveryProofRole, type SourcingOrderStatus } from "@/lib/alibaba-sourcing";

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(candidate: unknown): SourcingOrderStatus | null {
  switch (candidate) {
    case "checkout_created":
    case "grouped_sea":
    case "ready_to_ship":
    case "submitted_to_supplier":
    case "air_batch_pending":
    case "sea_batch_pending":
    case "supplier_payment_requested":
    case "supplier_payment_failed":
    case "supplier_paid_partial":
    case "supplier_paid":
    case "shipment_triggered":
    case "in_transit_to_agent":
    case "delivered_to_agent":
    case "relay_ready":
    case "completed":
      return candidate;
    default:
      return null;
  }
}

function normalizeProofRole(candidate: unknown): SourcingDeliveryProofRole {
  switch (candidate) {
    case "agent_to_forwarder":
    case "arrival_scan":
    case "relay_release":
      return candidate;
    default:
      return "supplier_to_agent";
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const order = await getSourcingOrderById(id);

  if (!order) {
    return NextResponse.json({ message: "Commande sourcing introuvable." }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "launch-supplier-payment") {
    try {
      const launchedOrder = await launchSourcingSupplierPaymentForOrder(id, "admin-order-manual");
      return NextResponse.json({ order: launchedOrder });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de lancer le paiement fournisseur.";
      return NextResponse.json({ message }, { status: 400 });
    }
  }

  if (action === "repair-supplier-order") {
    try {
      const repairedOrder = await repairBlockedSourcingOrderForSupplierPayment(id);
      return NextResponse.json({ order: repairedOrder });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de reprendre cette commande fournisseur.";
      return NextResponse.json({ message }, { status: 400 });
    }
  }

  const currentMeta = getSourcingOrderMeta(order);
  const derivedPlan = resolveSourcingDeliveryPlan({
    countryCode: order.countryCode,
    city: order.city,
    deliveryProfile: currentMeta.deliveryProfile,
  });
  const workflow = currentMeta.workflow ?? derivedPlan.workflow;
  const timestamp = nowIso();
  let nextOrder = { ...order, updatedAt: timestamp };
  let nextWorkflow = { ...workflow, proofs: [...workflow.proofs] };

  if (action === "add-proof") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ message: "Le titre de la preuve est obligatoire." }, { status: 400 });
    }

    nextWorkflow.proofs.push({
      id: `proof-${Date.now()}`,
      role: normalizeProofRole(body?.role),
      title,
      note: typeof body?.note === "string" && body.note.trim().length > 0 ? body.note.trim() : undefined,
      mediaUrl: typeof body?.mediaUrl === "string" && body.mediaUrl.trim().length > 0 ? body.mediaUrl.trim() : undefined,
      actorLabel: typeof body?.actorLabel === "string" && body.actorLabel.trim().length > 0 ? body.actorLabel.trim() : undefined,
      createdAt: timestamp,
    });
  } else if (action === "set-relay-point") {
    const relayPointAddress = typeof body?.relayPointAddress === "string" ? body.relayPointAddress.trim() : "";
    if (!relayPointAddress) {
      return NextResponse.json({ message: "L'adresse du point relais est obligatoire." }, { status: 400 });
    }

    nextWorkflow = {
      ...nextWorkflow,
      relayPointAddress,
      relayPointLabel: typeof body?.relayPointLabel === "string" && body.relayPointLabel.trim().length > 0 ? body.relayPointLabel.trim() : undefined,
      availableForPickupAt: timestamp,
    };
    nextOrder.status = "relay_ready";
  } else if (action === "update-status") {
    const nextStatus = normalizeStatus(body?.status);
    if (!nextStatus) {
      return NextResponse.json({ message: "Statut sourcing invalide." }, { status: 400 });
    }

    nextOrder.status = nextStatus;
    if (nextStatus === "delivered_to_agent") {
      nextWorkflow.deliveredToAgentAt = timestamp;
    }
    if (nextStatus === "completed") {
      nextWorkflow.completedAt = timestamp;
    }
  } else {
    return NextResponse.json({ message: "Action admin invalide." }, { status: 400 });
  }

  nextOrder = withSourcingOrderMeta(nextOrder, {
    deliveryProfile: currentMeta.deliveryProfile ?? derivedPlan.deliveryProfile,
    workflow: nextWorkflow,
  });
  await saveSourcingOrder(nextOrder);

  return NextResponse.json({ order: nextOrder });
}