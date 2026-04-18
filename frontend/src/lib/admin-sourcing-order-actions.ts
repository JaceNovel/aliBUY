import "server-only";

import { randomUUID } from "node:crypto";

import {
  getSourcingAlibabaPostPaymentAutomationState,
  getSourcingOrderMeta,
  isSourcingOrderClientPaid,
  resolveSourcingDeliveryPlan,
  withSourcingOrderMeta,
  type SourcingDeliveryProfile,
  type SourcingDeliveryNoteExportRecord,
  type SourcingDeliveryProofRole,
  type SourcingForwarderHub,
  type SourcingManualFulfillmentMeta,
  type SourcingManyChatContext,
  type SourcingOrder,
  type SourcingOrderStatus,
} from "@/lib/alibaba-sourcing";
import { getAdminOrderParcelSnapshot } from "@/lib/admin-data";
import { getDeliveryNoteDocumentNumber } from "@/lib/admin-sourcing-delivery-note-data";
import { generateAdminSourcingDeliveryNotePdf } from "@/lib/admin-sourcing-delivery-note-pdf";
import { triggerManyChatLogisticsUpdate } from "@/lib/manychat";
import {
  launchSourcingSupplierPaymentForOrder,
  repairBlockedSourcingOrderForSupplierPayment,
} from "@/lib/sourcing-batch-service";
import { getSourcingOrderById, saveSourcingOrder } from "@/lib/sourcing-store";

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStatusLabel(status: SourcingOrderStatus) {
  switch (status) {
    case "air_batch_pending":
      return "En attente lot avion";
    case "sea_batch_pending":
      return "En attente lot maritime";
    case "supplier_payment_requested":
      return "Paiement fournisseur en cours";
    case "supplier_payment_failed":
      return "Paiement fournisseur a reprendre";
    case "supplier_paid_partial":
      return "Paiement fournisseur partiel";
    case "supplier_paid":
      return "Commande fournisseur reglee";
    case "shipment_triggered":
      return "Expedition declenchee";
    case "in_transit_to_agent":
      return "En transit vers agent";
    case "delivered_to_agent":
      return "Livre a l'agent";
    case "relay_ready":
      return "Disponible au point relais";
    case "completed":
      return "Commande remise au client";
    default:
      return "Commande en traitement";
  }
}

function buildManualManyChatUpdate(order: SourcingOrder) {
  const meta = getSourcingOrderMeta(order);
  const manualFulfillment = meta.manualFulfillment;
  const automation = getSourcingAlibabaPostPaymentAutomationState(order);
  const firstTracking = automation?.trades.flatMap((trade) => trade.tracking).find((entry) => Boolean(entry.trackingNumber));

  const detailParts = [
    manualFulfillment?.checkpointLabel,
    manualFulfillment?.checkpointNote,
    firstTracking?.trackingNumber
      ? `Suivi fournisseur: ${firstTracking.carrier ? `${firstTracking.carrier} ` : ""}${firstTracking.trackingNumber}`
      : undefined,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  return {
    title: manualFulfillment?.statusLabel?.trim() || getStatusLabel(order.status),
    detail: detailParts.join(". ") || undefined,
  };
}

function withWorkflowTimestamps(order: SourcingOrder, status: SourcingOrderStatus) {
  const meta = getSourcingOrderMeta(order);
  const currentWorkflow = meta.workflow;
  const timestamp = nowIso();

  return withSourcingOrderMeta({
    ...order,
    status,
    updatedAt: timestamp,
  }, {
    workflow: {
      routeType: currentWorkflow?.routeType ?? "afripay-final-mile",
      freeDeliveryEligible: currentWorkflow?.freeDeliveryEligible !== false,
      supplierDeliveryAddressRole: currentWorkflow?.supplierDeliveryAddressRole ?? "afripay-agent",
      relayPointAddress: currentWorkflow?.relayPointAddress,
      relayPointLabel: currentWorkflow?.relayPointLabel,
      availableForPickupAt: status === "relay_ready"
        ? currentWorkflow?.availableForPickupAt || timestamp
        : currentWorkflow?.availableForPickupAt,
      deliveredToAgentAt: status === "delivered_to_agent"
        ? currentWorkflow?.deliveredToAgentAt || timestamp
        : currentWorkflow?.deliveredToAgentAt,
      completedAt: status === "completed"
        ? currentWorkflow?.completedAt || timestamp
        : currentWorkflow?.completedAt,
      proofs: currentWorkflow?.proofs ?? [],
    },
    deliveryProfile: meta.deliveryProfile,
    parcel: meta.parcel,
    manualFulfillment: meta.manualFulfillment,
    deliveryNoteExports: meta.deliveryNoteExports,
    promo: meta.promo,
    sharedCart: meta.sharedCart,
    paymentContext: meta.paymentContext,
    manychat: meta.manychat,
    freeDeal: meta.freeDeal,
  });
}

async function persistOrder(order: SourcingOrder) {
  await saveSourcingOrder(order);
  return order;
}

async function ensureOrder(orderId: string) {
  const order = await getSourcingOrderById(orderId);
  if (!order) {
    throw new Error("Commande sourcing introuvable.");
  }

  return order;
}

function buildUpdatedManyChatContext(existing: SourcingManyChatContext | undefined, payload: Record<string, unknown>) {
  const subscriberId = normalizeString(payload.subscriberId);
  const flowId = normalizeOptionalString(payload.flowId);
  const paidTagId = normalizeOptionalString(payload.paidTagId);

  if (!subscriberId) {
    if (!flowId && !paidTagId) {
      return undefined;
    }

    throw new Error("Le subscriber ManyChat est obligatoire pour enregistrer la liaison de suivi.");
  }

  return {
    ...existing,
    subscriberId,
    flowId,
    paidTagId,
  } satisfies SourcingManyChatContext;
}

function buildUpdatedManualFulfillment(existing: SourcingManualFulfillmentMeta | undefined, payload: Record<string, unknown>) {
  return {
    ...existing,
    enabled: payload.enabled === true,
    statusLabel: normalizeOptionalString(payload.statusLabel),
    checkpointLabel: normalizeOptionalString(payload.checkpointLabel),
    checkpointNote: normalizeOptionalString(payload.checkpointNote),
    agentName: normalizeOptionalString(payload.agentName),
    agentPhone: normalizeOptionalString(payload.agentPhone),
    etaLabel: normalizeOptionalString(payload.etaLabel),
    lastUpdatedAt: nowIso(),
  } satisfies SourcingManualFulfillmentMeta;
}

async function applyMetaUpdate(order: SourcingOrder, metaUpdate: Parameters<typeof withSourcingOrderMeta>[1]) {
  const nextOrder = withSourcingOrderMeta({
    ...order,
    updatedAt: nowIso(),
  }, metaUpdate);
  return persistOrder(nextOrder);
}

function mergeWorkflowPreservingProofs(order: SourcingOrder, patch: Partial<NonNullable<ReturnType<typeof getSourcingOrderMeta>["workflow"]>>) {
  const meta = getSourcingOrderMeta(order);
  const workflow = meta.workflow;

  return {
    routeType: patch.routeType ?? workflow?.routeType ?? "afripay-final-mile",
    freeDeliveryEligible: patch.freeDeliveryEligible ?? workflow?.freeDeliveryEligible ?? true,
    supplierDeliveryAddressRole: patch.supplierDeliveryAddressRole ?? workflow?.supplierDeliveryAddressRole ?? "afripay-agent",
    relayPointAddress: patch.relayPointAddress ?? workflow?.relayPointAddress,
    relayPointLabel: patch.relayPointLabel ?? workflow?.relayPointLabel,
    availableForPickupAt: patch.availableForPickupAt ?? workflow?.availableForPickupAt,
    deliveredToAgentAt: patch.deliveredToAgentAt ?? workflow?.deliveredToAgentAt,
    completedAt: patch.completedAt ?? workflow?.completedAt,
    proofs: patch.proofs ?? workflow?.proofs ?? [],
  };
}

async function overrideDeliveryRoute(order: SourcingOrder, payload: Record<string, unknown>) {
  const mode = payload.mode === "forwarder" ? "forwarder" : "direct";
  const hub: SourcingForwarderHub = payload.hub === "lome" ? "lome" : "china";
  const meta = getSourcingOrderMeta(order);
  const currentProfile = meta.deliveryProfile;
  const forwarderAddressBlock = currentProfile?.forwarder?.addressBlock
    || [order.addressLine1, order.addressLine2, `${order.city} ${order.postalCode || ""}`.trim(), order.countryCode]
      .filter(Boolean)
      .join("\n");
  const nextProfile: SourcingDeliveryProfile = mode === "forwarder"
    ? {
        ...currentProfile,
        mode: "forwarder" as const,
        forwarder: {
          hub,
          addressBlock: forwarderAddressBlock,
          parcelMarking: currentProfile?.forwarder?.parcelMarking || `Client ${order.customerName} ${order.customerPhone}`,
        },
      }
    : {
        ...currentProfile,
        mode: "direct" as const,
        forwarder: undefined,
      };
  const resolved = resolveSourcingDeliveryPlan({
    countryCode: order.countryCode,
    city: order.city,
    deliveryProfile: nextProfile,
  });

  const updatedOrder = await applyMetaUpdate(order, {
    deliveryProfile: {
      ...resolved.deliveryProfile,
      detectedCountryCode: currentProfile?.detectedCountryCode,
      detectedCountryLabel: currentProfile?.detectedCountryLabel,
      detectedCity: currentProfile?.detectedCity,
      googleMapsUrl: currentProfile?.googleMapsUrl,
      useExactPosition: currentProfile?.useExactPosition,
    },
    workflow: mergeWorkflowPreservingProofs(order, {
      routeType: resolved.workflow.routeType,
      freeDeliveryEligible: resolved.workflow.freeDeliveryEligible,
      supplierDeliveryAddressRole: resolved.workflow.supplierDeliveryAddressRole,
    }),
    parcel: meta.parcel,
    manualFulfillment: meta.manualFulfillment,
    deliveryNoteExports: meta.deliveryNoteExports,
    promo: meta.promo,
    sharedCart: meta.sharedCart,
    paymentContext: meta.paymentContext,
    manychat: meta.manychat,
    freeDeal: meta.freeDeal,
  });

  if (payload.relaunch === true && isSourcingOrderClientPaid(updatedOrder)) {
    try {
      const relaunchedOrder = await repairBlockedSourcingOrderForSupplierPayment(updatedOrder.id);
      return {
        order: relaunchedOrder,
        relaunchMessage: "Relance fournisseur rejouee apres changement de route.",
      };
    } catch (error) {
      return {
        order: updatedOrder,
        relaunchMessage: `Route mise a jour, mais la relance fournisseur a echoue: ${error instanceof Error ? error.message : "erreur inconnue"}`,
      };
    }
  }

  return { order: updatedOrder };
}

export async function updateAdminSourcingOrder(orderId: string, payload: unknown) {
  if (!isObjectRecord(payload)) {
    throw new Error("Charge utile invalide.");
  }

  const action = normalizeString(payload.action);
  if (!action) {
    throw new Error("Action admin sourcing manquante.");
  }

  const currentOrder = await ensureOrder(orderId);
  const meta = getSourcingOrderMeta(currentOrder);
  let nextOrder = currentOrder;
  let relaunchMessage: string | undefined;

  switch (action) {
    case "update-status": {
      const status = normalizeString(payload.status) as SourcingOrderStatus;
      nextOrder = await persistOrder(withWorkflowTimestamps(currentOrder, status));
      break;
    }

    case "mark-client-paid": {
      nextOrder = await persistOrder({
        ...currentOrder,
        paymentStatus: "paid",
        monerooPaymentStatus: currentOrder.monerooPaymentStatus ?? "manual_admin_paid",
        paidAt: currentOrder.paidAt ?? nowIso(),
        updatedAt: nowIso(),
      });
      break;
    }

    case "set-relay-point": {
      nextOrder = await applyMetaUpdate(currentOrder, {
        workflow: mergeWorkflowPreservingProofs(currentOrder, {
          relayPointAddress: normalizeOptionalString(payload.relayPointAddress),
          relayPointLabel: normalizeOptionalString(payload.relayPointLabel),
        }),
        deliveryProfile: meta.deliveryProfile,
        parcel: meta.parcel,
        manualFulfillment: meta.manualFulfillment,
        deliveryNoteExports: meta.deliveryNoteExports,
        promo: meta.promo,
        sharedCart: meta.sharedCart,
        paymentContext: meta.paymentContext,
        manychat: meta.manychat,
        freeDeal: meta.freeDeal,
      });
      break;
    }

    case "update-manual-fulfillment": {
      nextOrder = await applyMetaUpdate(currentOrder, {
        workflow: meta.workflow,
        deliveryProfile: meta.deliveryProfile,
        parcel: meta.parcel,
        manualFulfillment: buildUpdatedManualFulfillment(meta.manualFulfillment, payload),
        deliveryNoteExports: meta.deliveryNoteExports,
        promo: meta.promo,
        sharedCart: meta.sharedCart,
        paymentContext: meta.paymentContext,
        manychat: meta.manychat,
        freeDeal: meta.freeDeal,
      });
      break;
    }

    case "update-manychat-link": {
      nextOrder = await applyMetaUpdate(currentOrder, {
        workflow: meta.workflow,
        deliveryProfile: meta.deliveryProfile,
        parcel: meta.parcel,
        manualFulfillment: meta.manualFulfillment,
        deliveryNoteExports: meta.deliveryNoteExports,
        promo: meta.promo,
        sharedCart: meta.sharedCart,
        paymentContext: meta.paymentContext,
        manychat: buildUpdatedManyChatContext(meta.manychat, payload),
        freeDeal: meta.freeDeal,
      });
      break;
    }

    case "send-whatsapp-update-now": {
      if (!meta.manychat?.subscriberId) {
        throw new Error("Aucun subscriber ManyChat n'est lie a cette commande.");
      }

      nextOrder = await triggerManyChatLogisticsUpdate(currentOrder, buildManualManyChatUpdate(currentOrder));
      break;
    }

    case "update-parcel-manual": {
      const existingParcel = meta.parcel;
      const photoUrl = normalizeOptionalString(payload.photoUrl);
      const photoLabel = normalizeOptionalString(payload.photoLabel);
      nextOrder = await applyMetaUpdate(currentOrder, {
        workflow: meta.workflow,
        deliveryProfile: meta.deliveryProfile,
        parcel: {
          note: normalizeOptionalString(payload.note),
          updatedAt: nowIso(),
          photos: photoUrl
            ? [
                ...(existingParcel?.photos ?? []),
                { id: randomUUID(), url: photoUrl, label: photoLabel, createdAt: nowIso() },
              ]
            : (existingParcel?.photos ?? []),
        },
        manualFulfillment: meta.manualFulfillment,
        deliveryNoteExports: meta.deliveryNoteExports,
        promo: meta.promo,
        sharedCart: meta.sharedCart,
        paymentContext: meta.paymentContext,
        manychat: meta.manychat,
        freeDeal: meta.freeDeal,
      });
      break;
    }

    case "remove-parcel-photo": {
      const photoId = normalizeString(payload.photoId);
      nextOrder = await applyMetaUpdate(currentOrder, {
        workflow: meta.workflow,
        deliveryProfile: meta.deliveryProfile,
        parcel: {
          note: meta.parcel?.note,
          updatedAt: nowIso(),
          photos: (meta.parcel?.photos ?? []).filter((entry) => entry.id !== photoId),
        },
        manualFulfillment: meta.manualFulfillment,
        deliveryNoteExports: meta.deliveryNoteExports,
        promo: meta.promo,
        sharedCart: meta.sharedCart,
        paymentContext: meta.paymentContext,
        manychat: meta.manychat,
        freeDeal: meta.freeDeal,
      });
      break;
    }

    case "add-proof": {
      const role = normalizeString(payload.role) as SourcingDeliveryProofRole;
      const title = normalizeString(payload.title);
      if (!title) {
        throw new Error("Le titre de la preuve est obligatoire.");
      }

      nextOrder = await applyMetaUpdate(currentOrder, {
        workflow: mergeWorkflowPreservingProofs(currentOrder, {
          proofs: [
            ...(meta.workflow?.proofs ?? []),
            {
              id: randomUUID(),
              role,
              title,
              note: normalizeOptionalString(payload.note),
              mediaUrl: normalizeOptionalString(payload.mediaUrl),
              actorLabel: normalizeOptionalString(payload.actorLabel),
              createdAt: nowIso(),
            },
          ],
        }),
        deliveryProfile: meta.deliveryProfile,
        parcel: meta.parcel,
        manualFulfillment: meta.manualFulfillment,
        deliveryNoteExports: meta.deliveryNoteExports,
        promo: meta.promo,
        sharedCart: meta.sharedCart,
        paymentContext: meta.paymentContext,
        manychat: meta.manychat,
        freeDeal: meta.freeDeal,
      });
      break;
    }

    case "launch-supplier-payment": {
      nextOrder = await launchSourcingSupplierPaymentForOrder(currentOrder.id, "admin-order-manual");
      break;
    }

    case "repair-supplier-order": {
      nextOrder = await repairBlockedSourcingOrderForSupplierPayment(currentOrder.id);
      break;
    }

    case "override-delivery-route": {
      const overrideResult = await overrideDeliveryRoute(currentOrder, payload);
      nextOrder = overrideResult.order;
      relaunchMessage = overrideResult.relaunchMessage;
      break;
    }

    default:
      throw new Error("Action admin sourcing non prise en charge.");
  }

  return {
    order: nextOrder,
    parcelSnapshot: await getAdminOrderParcelSnapshot(nextOrder),
    ...(relaunchMessage ? { relaunchMessage } : {}),
  };
}

export async function exportAdminSourcingDeliveryNote(orderId: string, disposition: "inline" | "attachment", exportedByEmail?: string) {
  const order = await ensureOrder(orderId);
  const parcelSnapshot = await getAdminOrderParcelSnapshot(order);
  const documentNumber = getDeliveryNoteDocumentNumber(order);
  const pdf = await generateAdminSourcingDeliveryNotePdf(order, parcelSnapshot);
  const meta = getSourcingOrderMeta(order);
  const nextExports: SourcingDeliveryNoteExportRecord[] = [
    {
      id: randomUUID(),
      documentNumber,
      disposition,
      exportedAt: nowIso(),
      exportedByEmail: normalizeOptionalString(exportedByEmail),
    },
    ...(meta.deliveryNoteExports ?? []),
  ].slice(0, 25);

  const updatedOrder = withSourcingOrderMeta({
    ...order,
    updatedAt: nowIso(),
  }, {
    workflow: meta.workflow,
    deliveryProfile: meta.deliveryProfile,
    parcel: meta.parcel,
    manualFulfillment: meta.manualFulfillment,
    deliveryNoteExports: nextExports,
    promo: meta.promo,
    sharedCart: meta.sharedCart,
    paymentContext: meta.paymentContext,
    manychat: meta.manychat,
    freeDeal: meta.freeDeal,
  });

  await saveSourcingOrder(updatedOrder);

  return {
    pdf,
    documentNumber,
  };
}
