"use client";

import { startTransition, useMemo, useState } from "react";
import { Check, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";

import type { CustomerAddressRecord } from "@/lib/customer-data-store";

type AddressFormState = {
  label: string;
  recipientName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
};

const emptyForm: AddressFormState = {
  label: "",
  recipientName: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "CI",
  isDefault: false,
};

function toFormState(address?: CustomerAddressRecord): AddressFormState {
  if (!address) {
    return emptyForm;
  }

  return {
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    email: address.email ?? "",
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode ?? "",
    countryCode: address.countryCode,
    isDefault: address.isDefault,
  };
}

function formatAddress(address: CustomerAddressRecord) {
  return [address.addressLine1, address.addressLine2, `${address.city}, ${address.state}`, address.postalCode, address.countryCode]
    .filter(Boolean)
    .join(" · ");
}

export function AccountAddressBookClient({ initialAddresses }: { initialAddresses: CustomerAddressRecord[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormState>(() => toFormState(initialAddresses.find((address) => address.isDefault)));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const editingAddress = useMemo(
    () => addresses.find((address) => address.id === editingAddressId),
    [addresses, editingAddressId],
  );

  const resetForm = () => {
    setEditingAddressId(null);
    setForm({ ...emptyForm, isDefault: addresses.length === 0 });
  };

  const syncAddresses = (nextAddresses: CustomerAddressRecord[]) => {
    const sorted = [...nextAddresses].sort((left, right) => {
      if (left.isDefault === right.isDefault) {
        return right.updatedAt.localeCompare(left.updatedAt);
      }

      return left.isDefault ? -1 : 1;
    });

    setAddresses(sorted);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setFeedback(null);

    const endpoint = editingAddressId ? `/api/account/addresses/${editingAddressId}` : "/api/account/addresses";
    const method = editingAddressId ? "PUT" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = await response.json().catch(() => null);
    setIsSubmitting(false);

    if (!response.ok) {
      setFeedback({ type: "error", message: payload?.message ?? "Impossible d'enregistrer l'adresse." });
      return;
    }

    const address = payload.address as CustomerAddressRecord;
    const nextAddresses = editingAddressId
      ? addresses.map((item) => item.id === address.id ? address : item).map((item) => address.isDefault && item.id !== address.id ? { ...item, isDefault: false } : item)
      : [address, ...addresses.map((item) => address.isDefault ? { ...item, isDefault: false } : item)];

    syncAddresses(nextAddresses);
    setFeedback({ type: "success", message: editingAddressId ? "Adresse mise à jour." : "Adresse enregistrée." });
    resetForm();
  };

  const handleEdit = (address: CustomerAddressRecord) => {
    setEditingAddressId(address.id);
    setForm(toFormState(address));
    setFeedback(null);
  };

  const handleSetDefault = async (addressId: string) => {
    setFeedback(null);

    const response = await fetch(`/api/account/addresses/${addressId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set-default" }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setFeedback({ type: "error", message: payload?.message ?? "Impossible de changer l'adresse par défaut." });
      return;
    }

    syncAddresses(addresses.map((address) => ({ ...address, isDefault: address.id === addressId })));
    startTransition(() => {
      setFeedback({ type: "success", message: "Adresse par défaut mise à jour." });
    });
  };

  const handleDelete = async (addressId: string) => {
    setFeedback(null);

    const response = await fetch(`/api/account/addresses/${addressId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setFeedback({ type: "error", message: payload?.message ?? "Impossible de supprimer l'adresse." });
      return;
    }

    const nextAddresses = addresses.filter((address) => address.id !== addressId);
    const hasDefault = nextAddresses.some((address) => address.isDefault);
    syncAddresses(hasDefault ? nextAddresses : nextAddresses.map((address, index) => index === 0 ? { ...address, isDefault: true } : address));
    if (editingAddressId === addressId) {
      resetForm();
    }
    setFeedback({ type: "success", message: "Adresse supprimée." });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
      <section className="space-y-4">
        {feedback ? (
          <div className={[
            "rounded-[20px] px-4 py-3 text-[13px] font-semibold",
            feedback.type === "success" ? "bg-[#edf8f1] text-[#127a46]" : "bg-[#fde8e8] text-[#b42318]",
          ].join(" ")}>
            {feedback.message}
          </div>
        ) : null}

        {addresses.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#d8d8d8] bg-[#fcfaf8] px-5 py-8 text-center sm:px-8 sm:py-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1e8] text-[#ff6a00]">
              <MapPinned className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-[22px] font-bold tracking-[-0.04em] text-[#222]">Aucune adresse enregistrée</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#666]">
              Ajoutez votre première adresse de livraison pour accélérer vos prochaines commandes.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {addresses.map((address) => (
              <article key={address.id} className="rounded-[24px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5 sm:px-5 sm:py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-semibold text-[#222]">{address.label}</h2>
                      {address.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff2e9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d85300]">
                          <Check className="h-3.5 w-3.5" />
                          Par défaut
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-[15px] font-medium text-[#222]">{address.recipientName}</div>
                    <div className="mt-1 text-[14px] text-[#666]">{address.phone}{address.email ? ` · ${address.email}` : ""}</div>
                    <div className="mt-3 text-[14px] leading-6 text-[#4b5563]">{formatAddress(address)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!address.isDefault ? (
                      <button type="button" onClick={() => handleSetDefault(address.id)} className="inline-flex h-10 items-center justify-center rounded-full border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                        Mettre par défaut
                      </button>
                    ) : null}
                    <button type="button" onClick={() => handleEdit(address)} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#d7dce5] px-4 text-[13px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                    <button type="button" onClick={() => handleDelete(address.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#f2d1d1] bg-[#fff8f8] px-4 text-[13px] font-semibold text-[#c74444] transition hover:bg-[#fff1f1]">
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[26px] bg-[#fffaf5] p-4 ring-1 ring-[#f2e3d7] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0dfd1] pb-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d85300]">
              {editingAddress ? "Modifier" : "Nouvelle adresse"}
            </div>
            <h2 className="mt-1 text-[22px] font-bold tracking-[-0.04em] text-[#221f1c]">
              {editingAddress ? editingAddress.label : "Ajouter une adresse"}
            </h2>
          </div>
          <button type="button" onClick={resetForm} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#e2d5ca] bg-white px-4 text-[14px] font-semibold text-[#3e3026] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
            <Plus className="h-4 w-4" />
            Nouvelle fiche
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Libellé
            <input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Maison, Bureau, Boutique..." className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Nom du destinataire
            <input value={form.recipientName} onChange={(event) => setForm((current) => ({ ...current, recipientName: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Téléphone
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Email
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="sm:col-span-2 text-[13px] font-semibold text-[#4a3b31]">
            Adresse
            <input value={form.addressLine1} onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="sm:col-span-2 text-[13px] font-semibold text-[#4a3b31]">
            Complément d'adresse
            <input value={form.addressLine2} onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Ville
            <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Région / État
            <input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Code postal
            <input value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
          <label className="text-[13px] font-semibold text-[#4a3b31]">
            Pays
            <input value={form.countryCode} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#e6d8cb] bg-white px-4 text-[14px] uppercase text-[#221f1c] outline-none focus:border-[#ff6a00]" />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 text-[14px] font-medium text-[#3e3026] ring-1 ring-[#ead8ca]">
          <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} className="h-4 w-4 rounded border-[#d0b8a6] text-[#ff6a00] focus:ring-[#ff6a00]" />
          Utiliser cette adresse par défaut pour mes prochaines commandes.
        </label>

        <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#ff6a00] px-6 text-[15px] font-semibold text-white transition hover:bg-[#e55e00] disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? "Enregistrement..." : editingAddress ? "Mettre à jour l'adresse" : "Enregistrer l'adresse"}
        </button>
      </section>
    </div>
  );
}