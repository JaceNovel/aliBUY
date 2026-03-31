import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminOrderParcelSnapshot } from "@/lib/admin-data";
import {
  getSourcingOrderMeta,
  isSourcingOrderClientPaid,
  resolveSourcingDeliveryPlan,
  withSourcingOrderMeta,
  type SourcingDeliveryProfile,
  type SourcingDeliveryProofRole,
  type SourcingForwarderHub,
  type SourcingOrder,
  type SourcingOrderStatus,
} from "@/lib/alibaba-sourcing";
import {
  launchSourcingSupplierPaymentForOrder,
  repairBlockedSourcingOrderForSupplierPayment,
} from "@/lib/sourcing-batch-service";
import { getSourcingOrderById, saveSourcingOrder } from "@/lib/sourcing-store";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set<SourcingOrderStatus>([
  "air_batch_pending",
  "sea_batch_pending",
  "supplier_payment_requested",
  "supplier_payment_failed",
  "supplier_paid_partial",
  "supplier_paid",
  "shipment_triggered",
  "in_transit_to_agent",
  "delivered_to_agent",
  "relay_ready",
  "completed",
]);

const ALLOWED_PROOF_ROLES = new Set<SourcingDeliveryProofRole>([
  "supplier_to_agent",
  "agent_to_forwarder",
  "arrival_scan",
  "relay_release",
]);

function nowIso() {
  return new Date().toISOString();
}

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

function normalizeStatusWorkflow(order: SourcingOrder, status: SourcingOrderStatus) {
  const meta = getSourcingOrderMeta(order);
  const workflow = meta.workflow ?? {
    routeType: "afripay-final-mile",
    freeDeliveryEligible: false,
    supplierDeliveryAddressRole: "afripay-agent",
    proofs: [],
  };
  const processedAt = nowIso();

  return {
    ...workflow,
    deliveredToAgentAt: status === "delivered_to_agent" && !workflow.deliveredToAgentAt ? processedAt : workflow.deliveredToAgentAt,
    availableForPickupAt: status === "relay_ready" && !workflow.availableForPickupAt ? processedAt : workflow.availableForPickupAt,
    completedAt: status === "completed" && !workflow.completedAt ? processedAt : workflow.completedAt,
  };
}

async function saveOrderWithMeta(order: SourcingOrder, metaUpdate: Parameters<typeof withSourcingOrderMeta>[1]) {
  const nextOrder = withSourcingOrderMeta({
    ...order,
    updatedAt: nowIso(),
  }, metaUpdate);
  await saveSourcingOrder(nextOrder);
  return nextOrder;
}

async function buildOrderResponse(order: SourcingOrder, input?: { relaunchMessage?: string }) {
  return NextResponse.json({
    ok: true,
    order,
    parcelSnapshot: await getAdminOrderParcelSnapshot(order),
    ...(input?.relaunchMessage ? { relaunchMessage: input.relaunchMessage } : {}),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ message: "Acces refuse." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action.trim() : "";
  const { id } = await params;
  const order = await getSourcingOrderById(id);

  if (!order) {
    return NextResponse.json({ message: "Commande sourcing introuvable." }, { status: 404 });
  }

  try {
    if (action === "add-proof") {
      const title = typeof body?.title === "string" ? body.title.trim() : "";
      const role = typeof body?.role === "string" && ALLOWED_PROOF_ROLES.has(body.role as SourcingDeliveryProofRole)
        ? body.role as SourcingDeliveryProofRole
        : "supplier_to_agent";

      if (!title) {
        return badRequest("Le titre de la preuve est obligatoire.");
      }

      const meta = getSourcingOrderMeta(order);
      const workflow = meta.workflow ?? {
        routeType: "afripay-final-mile",
        freeDeliveryEligible: false,
        supplierDeliveryAddressRole: "afripay-agent",
        proofs: [],
      };

      const nextOrder = await saveOrderWithMeta(order, {
        workflow: {
          ...workflow,
          proofs: [
            ...workflow.proofs,
            {
              id: randomUUID(),
              role,
              title,
              note: typeof body?.note === "string" && body.note.trim() ? body.note.trim() : undefined,
              mediaUrl: typeof body?.mediaUrl === "string" && body.mediaUrl.trim() ? body.mediaUrl.trim() : undefined,
              actorLabel: typeof body?.actorLabel === "string" && body.actorLabel.trim() ? body.actorLabel.trim() : undefined,
              createdAt: nowIso(),
            },
          ],
        },
      });

      return buildOrderResponse(nextOrder);
    }

    if (action === "set-relay-point") {
      const relayPointAddress = typeof body?.relayPointAddress === "string" ? body.relayPointAddress.trim() : "";
      if (!relayPointAddress) {
        return badRequest("L'adresse du point relais est obligatoire.");
      }

      const meta = getSourcingOrderMeta(order);
      const workflow = meta.workflow ?? {
        routeType: "afripay-final-mile",
        freeDeliveryEligible: false,
        supplierDeliveryAddressRole: "afripay-agent",
        proofs: [],
      };

      const nextOrder = await saveOrderWithMeta(order, {
        workflow: {
          ...workflow,
          relayPointAddress,
          relayPointLabel: typeof body?.relayPointLabel === "string" && body.relayPointLabel.trim() ? body.relayPointLabel.trim() : workflow.relayPointLabel,
          availableForPickupAt: workflow.availableForPickupAt ?? nowIso(),
        },
      });

      return buildOrderResponse(nextOrder);
    }

    if (action === "update-status") {
      const status = typeof body?.status === "string" ? body.status as SourcingOrderStatus : undefined;
      if (!status || !ALLOWED_STATUSES.has(status)) {
        return badRequest("Statut sourcing invalide.");
      }

      const nextOrder = await saveOrderWithMeta({
        ...order,
        status,
      }, {
        workflow: normalizeStatusWorkflow(order, status),
      });

      return buildOrderResponse(nextOrder);
    }

    if (action === "update-parcel-manual") {
      const meta = getSourcingOrderMeta(order);
      const currentParcel = meta.parcel ?? { photos: [] };
      const nextNote = typeof body?.note === "string"
        ? body.note.trim() || undefined
        : currentParcel.note;
      const photoUrl = typeof body?.photoUrl === "string" && body.photoUrl.trim().length > 0 ? body.photoUrl.trim() : undefined;
      const photoLabel = typeof body?.photoLabel === "string" && body.photoLabel.trim().length > 0 ? body.photoLabel.trim() : undefined;
      const nextPhotos = photoUrl
        ? [
            ...currentParcel.photos,
            {
              id: randomUUID(),
              url: photoUrl,
              label: photoLabel,
              createdAt: nowIso(),
            },
          ]
        : currentParcel.photos;
      const nextOrder = await saveOrderWithMeta(order, {
        parcel: {
          note: nextNote,
          photos: nextPhotos,
          updatedAt: nowIso(),
        },
      });

      return buildOrderResponse(nextOrder);
    }

    if (action === "remove-parcel-photo") {
      const photoId = typeof body?.photoId === "string" ? body.photoId.trim() : "";
      if (!photoId) {
        return badRequest("Photo colis introuvable.");
      }

      const meta = getSourcingOrderMeta(order);
      const currentParcel = meta.parcel ?? { photos: [] };
      const nextOrder = await saveOrderWithMeta(order, {
        parcel: {
          note: currentParcel.note,
          photos: currentParcel.photos.filter((photo) => photo.id !== photoId),
          updatedAt: nowIso(),
        },
      });

      return buildOrderResponse(nextOrder);
    }

    if (action === "update-manual-fulfillment") {
      const meta = getSourcingOrderMeta(order);
      const nextOrder = await saveOrderWithMeta(order, {
        manualFulfillment: {
          enabled: body?.enabled === true,
          statusLabel: typeof body?.statusLabel === "string" && body.statusLabel.trim().length > 0 ? body.statusLabel.trim() : undefined,
          checkpointLabel: typeof body?.checkpointLabel === "string" && body.checkpointLabel.trim().length > 0 ? body.checkpointLabel.trim() : undefined,
          checkpointNote: typeof body?.checkpointNote === "string" && body.checkpointNote.trim().length > 0 ? body.checkpointNote.trim() : undefined,
          agentName: typeof body?.agentName === "string" && body.agentName.trim().length > 0 ? body.agentName.trim() : undefined,
          agentPhone: typeof body?.agentPhone === "string" && body.agentPhone.trim().length > 0 ? body.agentPhone.trim() : undefined,
          etaLabel: typeof body?.etaLabel === "string" && body.etaLabel.trim().length > 0 ? body.etaLabel.trim() : undefined,
          lastUpdatedAt: nowIso(),
        },
        parcel: meta.parcel,
      });

      return buildOrderResponse(nextOrder);
    }

    if (action === "launch-supplier-payment") {
      const nextOrder = await launchSourcingSupplierPaymentForOrder(order.id, "admin-order-manual");
      return buildOrderResponse(nextOrder);
    }

    if (action === "repair-supplier-order") {
      const nextOrder = await repairBlockedSourcingOrderForSupplierPayment(order.id);
      return buildOrderResponse(nextOrder);
    }

    if (action === "override-delivery-route") {
      const mode = body?.mode === "forwarder" ? "forwarder" : "direct";
      const hub: SourcingForwarderHub = body?.hub === "lome" ? "lome" : "china";
      const relaunch = body?.relaunch === true;
      const meta = getSourcingOrderMeta(order);
      const requestedProfile: SourcingDeliveryProfile = mode === "forwarder"
        ? {
            ...meta.deliveryProfile,
            mode: "forwarder" as const,
            forwarder: {
              hub,
              addressBlock: meta.deliveryProfile?.forwarder?.addressBlock ?? "",
              parcelMarking: meta.deliveryProfile?.forwarder?.parcelMarking,
            },
          }
        : {
            ...meta.deliveryProfile,
            mode: "direct" as const,
            forwarder: undefined,
          };

      const deliveryPlan = resolveSourcingDeliveryPlan({
        countryCode: order.countryCode,
        city: order.city,
        deliveryProfile: requestedProfile,
      });
      const currentWorkflow = meta.workflow;
      let nextOrder: SourcingOrder = await saveOrderWithMeta(order, {
        deliveryProfile: deliveryPlan.deliveryProfile,
        workflow: {
          ...deliveryPlan.workflow,
          proofs: currentWorkflow?.proofs ?? [],
          relayPointAddress: currentWorkflow?.relayPointAddress,
          relayPointLabel: currentWorkflow?.relayPointLabel,
          availableForPickupAt: currentWorkflow?.availableForPickupAt,
          deliveredToAgentAt: currentWorkflow?.deliveredToAgentAt,
          completedAt: currentWorkflow?.completedAt,
        },
      });

      let relaunchMessage: string | undefined;

      if (relaunch) {
        if (!isSourcingOrderClientPaid(nextOrder)) {
          relaunchMessage = "La route a été mise à jour, mais la commande client n'est pas encore marquée comme payée.";
        } else if (nextOrder.alibabaTradeIds.length === 0 || nextOrder.supplierOrderStatus !== "created") {
          nextOrder = await repairBlockedSourcingOrderForSupplierPayment(nextOrder.id);
          relaunchMessage = "La préparation fournisseur a été relancée avec la nouvelle route.";
        } else {
          relaunchMessage = "La route a été mise à jour. Une commande fournisseur existe déjà, contrôlez-la avant toute relance manuelle.";
        }
      }

      return buildOrderResponse(nextOrder, { relaunchMessage });
    }

    return badRequest("Action de commande sourcing non prise en charge.");
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Mise à jour impossible." }, { status: 400 });
  }
}