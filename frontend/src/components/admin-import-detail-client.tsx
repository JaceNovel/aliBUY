"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, CheckCircle2, ExternalLink, KeyRound, Mail, Phone, ShieldCheck, Truck } from "lucide-react";

import type { AdminImportRequest, AdminImportRequestStatus } from "@/lib/admin-data";
import {
  authTokenEndpointNotes,
  buyerAuthorizationFlow,
  callbackMessages,
  callbackRequirements,
  callbackSignatureGuide,
  categoryApis,
  ecoBuyerCatalogApis,
  ecoBuyerDiscoveryApis,
  ecoBuyerErrors,
  ecoBuyerPayloadNotes,
  ecoBuyerProductDataApis,
  ecoBuyerWorkflow,
  essentialApis,
  importToStoreFlow,
  inventoryAndProductApis,
  listingV2Errors,
  listingV2PayloadNotes,
  listingV2Workflow,
  logisticsExecutionApis,
  openPlatformOverview,
  orderExecutionErrors,
  orderExecutionPayloadNotes,
  orderExecutionWorkflow,
  orderReadAndWarehouseApis,
  orderErrors,
  orderStatuses,
  permissionRequestSteps,
  photobankApis,
  photobankErrors,
  productBulkOperationApis,
  productIntelligenceApis,
  productListingV2Apis,
  productLifecycleSteps,
  productPublishingErrors,
  productSchemaApis,
  requestSigningFields,
  requestSigningSteps,
  sellerAuthorizationFlow,
  shippingMultiFields,
  shippingRules,
  shippingSingleFields,
  sourcingWorkflow,
  tokenFields,
  videoBankApis,
  freightAndOrderExecutionApis,
} from "@/lib/alibaba-open-platform";

function statusClass(status: AdminImportRequestStatus) {
  if (status === "Complété") {
    return "bg-[#ecfdf3] text-[#027a48]";
  }

  if (status === "En traitement") {
    return "bg-[#eff4ff] text-[#175cd3]";
  }

  if (status === "Rejeté") {
    return "bg-[#fef3f2] text-[#d92d20]";
  }

  return "bg-[#ffefc2] text-[#9a6700]";
}

type AdminImportDetailClientProps = {
  request: AdminImportRequest;
};

const statusOptions: AdminImportRequestStatus[] = ["En attente", "En traitement", "Complété", "Rejeté"];

export function AdminImportDetailClient({ request }: AdminImportDetailClientProps) {
  const [noteDraft, setNoteDraft] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<AdminImportRequestStatus>(request.status);
  const [appliedStatus, setAppliedStatus] = useState<AdminImportRequestStatus>(request.status);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[18px] border border-[#dcdfe4] bg-[linear-gradient(135deg,#fff5ef_0%,#ffffff_45%,#eef4ff_100%)] p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[760px]">
              <div className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f0631b] backdrop-blur">Open Platform update</div>
              <h2 className="mt-3 text-[23px] font-black tracking-[-0.05em] text-[#111827] sm:text-[30px]">Cockpit AliExpress Open Platform pour import, OAuth, orders, shipping et webhooks</h2>
              <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-[#475467] sm:text-[15px] sm:leading-7">
                Cette demande sert maintenant de dossier d&apos;integration. La documentation recue fournie le socle pour l&apos;onboarding GGS, le compte linking, la creation de token, les appels order, l&apos;expedition API et les notifications push.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[340px] lg:grid-cols-1">
              <div className="rounded-[16px] border border-white/80 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Environment</div>
                <div className="mt-2 text-[15px] font-semibold text-[#111827]">{openPlatformOverview.environment}</div>
              </div>
              <div className="rounded-[16px] border border-white/80 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Auth service</div>
                <div className="mt-2 break-all text-[14px] font-semibold text-[#111827]">{openPlatformOverview.authServiceAddress}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Prerequis", value: String(openPlatformOverview.prerequisites.length), icon: CheckCircle2, accent: "bg-[#eefbf2] text-[#16a34a]" },
              { label: "APIs cles", value: String(essentialApis.length), icon: KeyRound, accent: "bg-[#eef4ff] text-[#2f67f6]" },
              { label: "Statuts order", value: String(orderStatuses.length), icon: Truck, accent: "bg-[#fff4ea] text-[#f97316]" },
              { label: "Push messages", value: String(callbackMessages.length), icon: BellRing, accent: "bg-[#f5efff] text-[#7c3aed]" },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.label} className="rounded-[16px] border border-white/70 bg-white/80 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] ${item.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{item.label}</div>
                  <div className="mt-1 text-[22px] font-black tracking-[-0.05em] text-[#111827]">{item.value}</div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
          <h2 className="text-[24px] font-bold tracking-[-0.04em] text-black">Informations sur le produit</h2>
          <div className="mt-7 space-y-6 text-[15px] text-black">
            <div>
              <div className="text-[14px] font-medium text-[#667085]">URL du produit</div>
              <a href={request.productUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[16px] text-[#386bf6] transition hover:text-[#214fce]">
                {request.productUrl}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div>
              <div className="text-[14px] font-medium text-[#667085]">Description du produit</div>
              <p className="mt-1 text-[17px] leading-8 text-black">{request.productDescription}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="text-[14px] font-medium text-[#667085]">Quantité</div>
                <div className="mt-1 text-[17px] text-black">{request.quantity}</div>
              </div>
              <div>
                <div className="text-[14px] font-medium text-[#667085]">Budget</div>
                <div className="mt-1 text-[17px] text-black">{request.budget}</div>
              </div>
            </div>

            <div>
              <div className="text-[14px] font-medium text-[#667085]">Informations supplémentaires</div>
              <p className="mt-1 text-[17px] leading-8 text-black">{request.additionalInfo}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
            <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Checklist d&apos;onboarding</h2>
            <div className="mt-5 space-y-3">
              {openPlatformOverview.prerequisites.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[14px] bg-[#f8fafc] px-4 py-3 text-[14px] leading-6 text-[#344054]">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f0631b]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
            <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Demande de permissions API</h2>
            <div className="mt-5 space-y-4">
              {permissionRequestSteps.map((step, index) => (
                <div key={step.title} className="flex gap-4 rounded-[14px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[13px] font-bold text-white">{index + 1}</div>
                  <div>
                    <div className="text-[15px] font-semibold text-[#111827]">{step.title}</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#667085]">{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#fff4ea] text-[#f0631b]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Flux Import to Store et sourcing</h2>
              <p className="mt-1 text-[13px] text-[#667085]">Basee sur les schemas fournis pour le programme d&apos;import magasin et la buyer sourcing solution.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Import to store</div>
              {importToStoreFlow.map((step, index) => (
                <div key={step.title} className="rounded-[16px] border border-[#edf1f6] bg-[#fcfcfd] px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#f0631b]">Etape {index + 1}</div>
                  <div className="mt-2 text-[16px] font-semibold text-[#111827]">{step.title}</div>
                  <div className="mt-1 text-[13px] leading-6 text-[#667085]">{step.detail}</div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="text-[14px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Buyer sourcing solution</div>
              {sourcingWorkflow.map((step, index) => (
                <div key={step.title} className="rounded-[16px] border border-[#edf1f6] bg-[#fcfcfd] px-4 py-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2f67f6]">Module {index + 1}</div>
                  <div className="mt-2 text-[16px] font-semibold text-[#111827]">{step.title}</div>
                  <div className="mt-1 text-[13px] leading-6 text-[#667085]">{step.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">OAuth, tokens et signature HTTP</h2>
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {[{ title: "Seller authorization", steps: sellerAuthorizationFlow, accent: "text-[#f0631b]" }, { title: "Buyer authorization", steps: buyerAuthorizationFlow, accent: "text-[#2f67f6]" }].map((section) => (
              <article key={section.title} className="rounded-[16px] border border-[#edf1f6] bg-[#fcfcfd] p-4">
                <div className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${section.accent}`}>{section.title}</div>
                <div className="mt-4 space-y-3">
                  {section.steps.map((step, index) => (
                    <div key={step.title} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[12px] font-bold text-white">{index + 1}</div>
                      <div>
                        <div className="text-[15px] font-semibold text-[#111827]">{step.title}</div>
                        <div className="mt-1 text-[13px] leading-6 text-[#667085]">{step.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Token fields to persist</div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="text-[11px] uppercase tracking-[0.08em] text-[#98a2b3]">
                    <tr>
                      <th className="pb-3 pr-4 font-semibold">Key</th>
                      <th className="pb-3 pr-4 font-semibold">Type</th>
                      <th className="pb-3 font-semibold">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenFields.map((field) => (
                      <tr key={field.key} className="border-t border-[#edf1f6] align-top text-[13px] text-[#344054]">
                        <td className="py-3 pr-4 font-semibold text-[#111827]">{field.key}</td>
                        <td className="py-3 pr-4">{field.value}</td>
                        <td className="py-3">{field.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">System params & signing</div>
              <div className="mt-4 space-y-3">
                {requestSigningFields.map((field) => (
                  <div key={field.name} className="rounded-[14px] bg-[#f8fafc] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[14px] font-semibold text-[#111827]">{field.name}</div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#667085]">{field.required}</span>
                    </div>
                    <div className="mt-1 text-[13px] text-[#667085]">{field.type} · {field.description}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {authTokenEndpointNotes.map((note) => (
              <div key={note.key} className="rounded-[16px] border border-[#edf1f6] bg-[#fcfcfd] px-4 py-4">
                <div className="text-[13px] font-semibold text-[#111827]">{note.key}</div>
                <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2f67f6]">{note.value}</div>
                {note.detail ? <div className="mt-2 text-[13px] leading-6 text-[#667085]">{note.detail}</div> : null}
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {requestSigningSteps.map((step, index) => (
              <div key={step.title} className="rounded-[16px] bg-[#111827] px-4 py-4 text-white">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Step {index + 1}</div>
                <div className="mt-2 text-[15px] font-semibold">{step.title}</div>
                <div className="mt-1 text-[13px] leading-6 text-white/75">{step.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Orders et shipping</h2>
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <article className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">APIs essentielles</div>
              <div className="mt-4 space-y-3">
                {essentialApis.map((api) => (
                  <div key={api.name} className="rounded-[14px] bg-[#fcfcfd] px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[15px] font-semibold text-[#111827]">{api.name}</div>
                      <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#2f67f6]">{api.path}</span>
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-[#667085]">{api.purpose}</div>
                    {api.note ? <div className="mt-1 text-[12px] text-[#98a2b3]">{api.note}</div> : null}
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Order status flow</div>
              <div className="mt-4 grid gap-3">
                {orderStatuses.map((status) => (
                  <div key={status.code} className="rounded-[14px] border border-[#edf1f6] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#111827] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">{status.code}</span>
                      <div className="text-[14px] font-semibold text-[#111827]">{status.label}</div>
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-[#667085]">{status.detail}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {[{ title: "Single shipment", fields: shippingSingleFields }, { title: "Multi-batch shipment", fields: shippingMultiFields }].map((section) => (
              <article key={section.title} className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{section.title}</div>
                <div className="mt-4 space-y-3">
                  {section.fields.map((field) => (
                    <div key={field.name} className="rounded-[14px] bg-[#f8fafc] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[14px] font-semibold text-[#111827]">{field.name}</div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#667085]">{field.type}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#667085]">{field.required}</span>
                      </div>
                      <div className="mt-1 text-[13px] leading-6 text-[#667085]">{field.description}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {shippingRules.map((rule) => (
              <div key={rule.title} className="rounded-[16px] border border-[#edf1f6] bg-[#fcfcfd] px-4 py-4">
                <div className="text-[14px] font-semibold text-[#111827]">{rule.title}</div>
                <div className="mt-2 text-[13px] leading-6 text-[#667085]">{rule.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Catalogue, photobank et publication produit ICBU</h2>
          <div className="mt-3 text-[13px] leading-6 text-[#667085]">
            Cette couche couvre la taxonomie categorie, la gestion media, l&apos;inventaire et tout le cycle schema de publication ou d&apos;edition produit.
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {productLifecycleSteps.map((step, index) => (
              <div key={step.title} className="rounded-[16px] bg-[linear-gradient(180deg,#fff8f2_0%,#ffffff_100%)] px-4 py-4 ring-1 ring-[#f4dfd2]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f0631b]">Stage {index + 1}</div>
                <div className="mt-2 text-[15px] font-semibold text-[#111827]">{step.title}</div>
                <div className="mt-1 text-[13px] leading-6 text-[#667085]">{step.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {[
              { title: "Category & schema discovery", items: categoryApis, accent: "text-[#2f67f6]" },
              { title: "Photobank & groups", items: photobankApis, accent: "text-[#f0631b]" },
              { title: "Product & inventory ops", items: inventoryAndProductApis, accent: "text-[#16a34a]" },
            ].map((section) => (
              <article key={section.title} className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${section.accent}`}>{section.title}</div>
                <div className="mt-4 space-y-3">
                  {section.items.map((api) => (
                    <div key={api.path} className="rounded-[14px] bg-[#fcfcfd] px-4 py-4">
                      <div className="text-[15px] font-semibold text-[#111827]">{api.name}</div>
                      <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{api.path}</div>
                      <div className="mt-2 text-[13px] leading-6 text-[#667085]">{api.purpose}</div>
                      {api.note ? <div className="mt-2 text-[12px] leading-5 text-[#98a2b3]">{api.note}</div> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[16px] border border-[#edf1f6] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Schema publish / render / update APIs</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {productSchemaApis.map((api) => (
                <div key={api.path} className="rounded-[14px] bg-[#f8fafc] px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[15px] font-semibold text-[#111827]">{api.name}</div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#667085]">{api.path}</span>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-[#667085]">{api.purpose}</div>
                  {api.note ? <div className="mt-2 text-[12px] leading-5 text-[#98a2b3]">{api.note}</div> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <article className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Photobank error watchlist</div>
              <div className="mt-4 space-y-3">
                {photobankErrors.map((error) => (
                  <div key={error.code} className="rounded-[14px] border border-[#edf1f6] px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#fff4ea] px-2.5 py-1 text-[11px] font-semibold text-[#f0631b]">{error.code}</span>
                      <div className="text-[15px] font-semibold text-[#111827]">{error.title}</div>
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Cause:</span> {error.cause}</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Resolution:</span> {error.resolution}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Product publish validation watchlist</div>
              <div className="mt-4 space-y-3">
                {productPublishingErrors.map((error) => (
                  <div key={error.code} className="rounded-[14px] border border-[#edf1f6] px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-semibold text-[#2f67f6]">{error.code}</span>
                      <div className="text-[15px] font-semibold text-[#111827]">{error.title}</div>
                    </div>
                    <div className="mt-2 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Cause:</span> {error.cause}</div>
                    <div className="mt-1 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Resolution:</span> {error.resolution}</div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Listing v2, IA categorie et operations bulk</h2>
          <div className="mt-3 text-[13px] leading-6 text-[#667085]">
            Cette couche couvre les endpoints v2 modernes pour predire la categorie, creer ou mettre a jour un listing, interroger les produits, gerer les templates d&apos;expedition et piloter prix, stock, suppression ou bascule online/offline.
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {listingV2Workflow.map((step, index) => (
              <div key={step.title} className="rounded-[16px] bg-[#111827] px-4 py-4 text-white">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Flow {index + 1}</div>
                <div className="mt-2 text-[15px] font-semibold">{step.title}</div>
                <div className="mt-1 text-[13px] leading-6 text-white/75">{step.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {[
              { title: "Prediction & category v2", items: productIntelligenceApis, accent: "text-[#7c3aed]" },
              { title: "Listing & query v2", items: productListingV2Apis, accent: "text-[#2f67f6]" },
              { title: "Bulk operations", items: productBulkOperationApis, accent: "text-[#16a34a]" },
            ].map((section) => (
              <article key={section.title} className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${section.accent}`}>{section.title}</div>
                <div className="mt-4 space-y-3">
                  {section.items.map((api) => (
                    <div key={api.path} className="rounded-[14px] bg-[#fcfcfd] px-4 py-4">
                      <div className="text-[15px] font-semibold text-[#111827]">{api.name}</div>
                      <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{api.path}</div>
                      <div className="mt-2 text-[13px] leading-6 text-[#667085]">{api.purpose}</div>
                      {api.note ? <div className="mt-2 text-[12px] leading-5 text-[#98a2b3]">{api.note}</div> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[16px] border border-[#edf1f6] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Payload notes for product_info and AI optimization</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {listingV2PayloadNotes.map((note) => (
                <div key={note.key} className="rounded-[14px] bg-[#f8fafc] px-4 py-4">
                  <div className="text-[15px] font-semibold text-[#111827]">{note.key}</div>
                  <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2f67f6]">{note.value}</div>
                  {note.detail ? <div className="mt-2 text-[13px] leading-6 text-[#667085]">{note.detail}</div> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[16px] border border-[#edf1f6] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Error watchlist for v2 listing and catalog ops</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {listingV2Errors.map((error) => (
                <div key={error.code} className="rounded-[14px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f5efff] px-2.5 py-1 text-[11px] font-semibold text-[#7c3aed]">{error.code}</span>
                    <div className="text-[15px] font-semibold text-[#111827]">{error.title}</div>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Cause:</span> {error.cause}</div>
                  <div className="mt-1 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Resolution:</span> {error.resolution}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Video bank et Eco Buyer sourcing APIs</h2>
          <div className="mt-3 text-[13px] leading-6 text-[#667085]">
            Cette couche regroupe la gestion video produit et les endpoints Buyer/Eco pour pousser un catalogue partenaire, faire du discovery, recuperer la data produit AliExpress et importer vers des channels stores.
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {ecoBuyerWorkflow.map((step, index) => (
              <div key={step.title} className="rounded-[16px] bg-[linear-gradient(180deg,#eef4ff_0%,#ffffff_100%)] px-4 py-4 ring-1 ring-[#d9e6ff]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f67f6]">Eco flow {index + 1}</div>
                <div className="mt-2 text-[15px] font-semibold text-[#111827]">{step.title}</div>
                <div className="mt-1 text-[13px] leading-6 text-[#667085]">{step.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-4">
            {[
              { title: "Video bank", items: videoBankApis, accent: "text-[#f0631b]" },
              { title: "Eco item sync", items: ecoBuyerCatalogApis, accent: "text-[#7c3aed]" },
              { title: "Eco discovery", items: ecoBuyerDiscoveryApis, accent: "text-[#16a34a]" },
              { title: "Eco product data", items: ecoBuyerProductDataApis, accent: "text-[#2f67f6]" },
            ].map((section) => (
              <article key={section.title} className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${section.accent}`}>{section.title}</div>
                <div className="mt-4 space-y-3">
                  {section.items.map((api) => (
                    <div key={api.path} className="rounded-[14px] bg-[#fcfcfd] px-4 py-4">
                      <div className="text-[15px] font-semibold text-[#111827]">{api.name}</div>
                      <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{api.path}</div>
                      <div className="mt-2 text-[13px] leading-6 text-[#667085]">{api.purpose}</div>
                      {api.note ? <div className="mt-2 text-[12px] leading-5 text-[#98a2b3]">{api.note}</div> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[16px] border border-[#edf1f6] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Eco request and response notes</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              {ecoBuyerPayloadNotes.map((note) => (
                <div key={note.key} className="rounded-[14px] bg-[#f8fafc] px-4 py-4">
                  <div className="text-[15px] font-semibold text-[#111827]">{note.key}</div>
                  <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2f67f6]">{note.value}</div>
                  {note.detail ? <div className="mt-2 text-[13px] leading-6 text-[#667085]">{note.detail}</div> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[16px] border border-[#edf1f6] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Video and eco watchlist</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {ecoBuyerErrors.map((error) => (
                <div key={error.code} className="rounded-[14px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#fff4ea] px-2.5 py-1 text-[11px] font-semibold text-[#f0631b]">{error.code}</span>
                    <div className="text-[15px] font-semibold text-[#111827]">{error.title}</div>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Cause:</span> {error.cause}</div>
                  <div className="mt-1 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Resolution:</span> {error.resolution}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Freight, BuyNow orders et execution logistique</h2>
          <div className="mt-3 text-[13px] leading-6 text-[#667085]">
            Cette couche couvre l&apos;estimation transport, la creation BuyNow, le paiement, les queries finance/order, l&apos;execution shipping, le tracking detaille et la lecture des warehouses avant fulfillment.
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {orderExecutionWorkflow.map((step, index) => (
              <div key={step.title} className="rounded-[16px] bg-[linear-gradient(180deg,#fff8f2_0%,#ffffff_100%)] px-4 py-4 ring-1 ring-[#f4dfd2]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f0631b]">Execution {index + 1}</div>
                <div className="mt-2 text-[15px] font-semibold text-[#111827]">{step.title}</div>
                <div className="mt-1 text-[13px] leading-6 text-[#667085]">{step.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {[
              { title: "Freight & payment", items: freightAndOrderExecutionApis, accent: "text-[#2f67f6]" },
              { title: "Logistics execution", items: logisticsExecutionApis, accent: "text-[#16a34a]" },
              { title: "Orders & warehouses", items: orderReadAndWarehouseApis, accent: "text-[#7c3aed]" },
            ].map((section) => (
              <article key={section.title} className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${section.accent}`}>{section.title}</div>
                <div className="mt-4 space-y-3">
                  {section.items.map((api) => (
                    <div key={api.path} className="rounded-[14px] bg-[#fcfcfd] px-4 py-4">
                      <div className="text-[15px] font-semibold text-[#111827]">{api.name}</div>
                      <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{api.path}</div>
                      <div className="mt-2 text-[13px] leading-6 text-[#667085]">{api.purpose}</div>
                      {api.note ? <div className="mt-2 text-[12px] leading-5 text-[#98a2b3]">{api.note}</div> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[16px] border border-[#edf1f6] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">BuyNow, freight and logistics payload notes</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              {orderExecutionPayloadNotes.map((note) => (
                <div key={note.key} className="rounded-[14px] bg-[#f8fafc] px-4 py-4">
                  <div className="text-[15px] font-semibold text-[#111827]">{note.key}</div>
                  <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2f67f6]">{note.value}</div>
                  {note.detail ? <div className="mt-2 text-[13px] leading-6 text-[#667085]">{note.detail}</div> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[16px] border border-[#edf1f6] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Execution watchlist</div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {orderExecutionErrors.map((error) => (
                <div key={error.code} className="rounded-[14px] border border-[#edf1f6] px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-semibold text-[#2f67f6]">{error.code}</span>
                    <div className="text-[15px] font-semibold text-[#111827]">{error.title}</div>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Cause:</span> {error.cause}</div>
                  <div className="mt-1 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Resolution:</span> {error.resolution}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)] sm:p-7">
          <h2 className="text-[22px] font-bold tracking-[-0.04em] text-black">Webhooks, securite callback et erreurs create order</h2>
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <article className="rounded-[16px] border border-[#edf1f6] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Supported messages</div>
              <div className="mt-4 space-y-3">
                {callbackMessages.map((message) => (
                  <div key={message.path} className="rounded-[14px] bg-[#fcfcfd] px-4 py-4">
                    <div className="text-[15px] font-semibold text-[#111827]">{message.name}</div>
                    <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2f67f6]">{message.path}</div>
                    <div className="mt-2 text-[13px] leading-6 text-[#667085]">{message.purpose}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[16px] bg-[#111827] p-4 text-white">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">Signature callback</div>
                <div className="mt-4 space-y-3">
                  {callbackSignatureGuide.map((item) => (
                    <div key={item.key}>
                      <div className="text-[14px] font-semibold">{item.key}: <span className="font-medium text-white/80">{item.value}</span></div>
                      {item.detail ? <div className="mt-1 text-[12px] leading-5 text-white/70">{item.detail}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="space-y-5">
              <div className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">Reception callback</div>
                <div className="mt-4 space-y-3">
                  {callbackRequirements.map((item) => (
                    <div key={item.title} className="rounded-[14px] bg-[#f8fafc] px-4 py-4">
                      <div className="text-[15px] font-semibold text-[#111827]">{item.title}</div>
                      <div className="mt-1 text-[13px] leading-6 text-[#667085]">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[16px] border border-[#edf1f6] p-4">
                <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">FAQ erreurs /buynow/order/create</div>
                <div className="mt-4 space-y-3">
                  {orderErrors.map((error) => (
                    <div key={error.code} className="rounded-[14px] border border-[#edf1f6] px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#fde8e8] px-2.5 py-1 text-[11px] font-semibold text-[#d92d20]">{error.code}</span>
                        <div className="text-[15px] font-semibold text-[#111827]">{error.title}</div>
                      </div>
                      <div className="mt-2 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Cause:</span> {error.cause}</div>
                      <div className="mt-1 text-[13px] leading-6 text-[#667085]"><span className="font-semibold text-[#344054]">Resolution:</span> {error.resolution}</div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
          <h2 className="text-[24px] font-bold tracking-[-0.04em] text-black">Notes internes</h2>
          <p className="mt-2 text-[14px] text-[#667085]">Ces notes ne sont visibles que par l&apos;équipe administrative</p>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Ajoutez des notes concernant cette demande..."
            className="mt-6 min-h-[188px] w-full rounded-[12px] border border-[#d0d5dd] px-5 py-4 text-[16px] text-black outline-none transition focus:border-[#e61b4d]"
          />

          {savedNote ? (
            <div className="mt-4 rounded-[12px] bg-[#f8f9fb] px-4 py-3 text-[14px] text-[#344054]">
              Dernières notes enregistrées: {savedNote}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setNoteDraft(savedNote);
                setFeedback(null);
              }}
              className="inline-flex h-12 items-center justify-center rounded-[12px] border border-[#d0d5dd] px-7 text-[15px] font-semibold text-black transition hover:border-[#b7bdc8]"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                setSavedNote(noteDraft.trim());
                setFeedback(noteDraft.trim() ? "Notes enregistrées localement." : "Notes vidées.");
              }}
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[#e61b4d] px-7 text-[15px] font-semibold text-white transition hover:bg-[#cf1544]"
            >
              Enregistrer les notes
            </button>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
          <h2 className="text-[24px] font-bold tracking-[-0.04em] text-black">Mettre à jour le statut</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {statusOptions.map((status) => {
              const isActive = selectedStatus === status;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className={[
                    "rounded-[10px] border px-5 py-3 text-[16px] font-medium transition",
                    isActive ? "border-[#e61b4d] bg-[#e61b4d] text-white" : "border-[#d0d5dd] bg-white text-black hover:border-[#e61b4d]/50",
                  ].join(" ")}
                >
                  {status}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setAppliedStatus(selectedStatus);
                setFeedback(`Statut mis à jour: ${selectedStatus}`);
              }}
              className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[#e61b4d] px-7 text-[15px] font-semibold text-white transition hover:bg-[#cf1544]"
            >
              Mettre à jour le statut
            </button>
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
          <h2 className="text-[24px] font-bold tracking-[-0.04em] text-black">Informations client</h2>
          <div className="mt-7 space-y-6 text-[15px] text-black">
            <div>
              <div className="text-[14px] font-medium text-[#667085]">Nom</div>
              <div className="mt-1 text-[17px]">{request.clientName}</div>
            </div>
            <div>
              <div className="text-[14px] font-medium text-[#667085]">Email</div>
              <Link href="/messages?tab=service" className="mt-1 inline-flex items-center gap-2 text-[16px] text-[#386bf6] transition hover:text-[#214fce]">
                <Mail className="h-4 w-4" />
                {request.email}
              </Link>
            </div>
            <div>
              <div className="text-[14px] font-medium text-[#667085]">Téléphone</div>
              <div className="mt-1 inline-flex items-center gap-2 text-[16px] text-[#386bf6]">
                <Phone className="h-4 w-4" />
                {request.phone}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
          <h2 className="text-[24px] font-bold tracking-[-0.04em] text-black">Détails de la demande</h2>
          <div className="mt-7 space-y-5 text-[15px] text-black">
            <div>
              <div className="text-[14px] font-medium text-[#667085]">Date de création</div>
              <div className="mt-1 text-[17px]">{request.createdAt}</div>
            </div>
            <div>
              <div className="text-[14px] font-medium text-[#667085]">Corridor</div>
              <div className="mt-1 text-[17px]">{request.corridor}</div>
            </div>
            <div>
              <div className="text-[14px] font-medium text-[#667085]">Agent assigné</div>
              <div className="mt-1 text-[17px]">{request.agent}</div>
            </div>
            <div>
              <div className="text-[14px] font-medium text-[#667085]">Tracking</div>
              <div className="mt-1 text-[17px]">{request.tracking}</div>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white p-7 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
          <h2 className="text-[24px] font-bold tracking-[-0.04em] text-black">Actions</h2>
          <div className="mt-7 space-y-3">
            <Link href="/messages?tab=service" className="flex h-12 items-center justify-center rounded-[12px] bg-[#e61b4d] px-5 text-[15px] font-semibold text-white transition hover:bg-[#cf1544]">
              Contacter le client
            </Link>
            <Link href="/quotes" className="flex h-12 items-center justify-center rounded-[12px] border border-[#d0d5dd] bg-white px-5 text-[15px] font-semibold text-black transition hover:border-[#b7bdc8]">
              Générer un devis
            </Link>
            <button
              type="button"
              onClick={() => setFeedback("Suppression simulée uniquement dans cette maquette.")}
              className="flex h-12 w-full items-center justify-center rounded-[12px] bg-[#f63d3d] px-5 text-[15px] font-semibold text-white transition hover:bg-[#e03535]"
            >
              Supprimer la demande
            </button>
          </div>
        </section>

        <section className="rounded-[18px] border border-[#dcdfe4] bg-white px-6 py-5 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#667085]">Statut actif</div>
              <div className="mt-2 text-[15px] font-semibold text-black">{request.requestCode.toUpperCase()}</div>
            </div>
            <span className={["inline-flex rounded-full px-3 py-1 text-[13px] font-semibold", statusClass(appliedStatus)].join(" ")}>{appliedStatus}</span>
          </div>
          {feedback ? <div className="mt-4 rounded-[12px] bg-[#f8f9fb] px-4 py-3 text-[14px] text-[#344054]">{feedback}</div> : null}
        </section>
      </aside>
    </div>
  );
}