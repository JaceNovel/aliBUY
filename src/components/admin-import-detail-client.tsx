"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Mail, Phone } from "lucide-react";

import type { AdminImportRequest, AdminImportRequestStatus } from "@/lib/admin-data";

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