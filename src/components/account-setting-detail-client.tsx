"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronRight, LogOut, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AccountSettingsRecord } from "@/lib/account-settings-store";
import type { AccountPageSlug } from "@/app/account/compte/account-links";

type Props = {
  slug: AccountPageSlug;
  page: {
    title: string;
    description: string;
    bullets: string[];
    accent: string;
  };
  initialUser: {
    email: string;
    displayName: string;
    firstName: string;
    createdAt: string;
  };
  initialSettings: AccountSettingsRecord;
};

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[16px] bg-white px-4 py-3 ring-1 ring-black/5">
      <span className="text-[14px] font-medium text-[#222] sm:text-[15px]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-[#d0d5dd] text-[#ff6a00] focus:ring-[#ff6a00]" />
    </label>
  );
}

export function AccountSettingDetailClient({ slug, page, initialUser, initialSettings }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [displayName, setDisplayName] = useState(initialUser.displayName);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [emailForm, setEmailForm] = useState({ newEmail: initialUser.email, password: "" });
  const [deleteForm, setDeleteForm] = useState({ confirmation: "", password: "" });

  const uploadProfilePhoto = async (file: File) => {
    setIsUploadingPhoto(true);
    setError(null);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/account/profile-photo", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Impossible d'envoyer cette photo.");
      }
      setSettings((current) => ({ ...current, profilePhotoUrl: payload.profilePhotoUrl }));
      setFeedback("Photo de profil mise à jour.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer cette photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const saveSettings = async (extra?: Record<string, unknown>) => {
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, ...settings, ...extra }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Impossible d'enregistrer ces informations.");
      }
      if (payload?.settings) {
        setSettings(payload.settings);
      }
      setFeedback("Modifications enregistrées.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer ces informations.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitPassword = async () => {
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Impossible de modifier le mot de passe.");
      }
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setFeedback("Mot de passe mis à jour.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le mot de passe.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitEmail = async () => {
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/change-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(emailForm),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Impossible de modifier l'adresse e-mail.");
      }
      setEmailForm((current) => ({ ...current, password: "", newEmail: payload?.email || current.newEmail }));
      setFeedback("Adresse e-mail mise à jour.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier l'adresse e-mail.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitDelete = async () => {
    setIsSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deleteForm),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Impossible de supprimer le compte.");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le compte.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderMainForm = () => {
    switch (slug) {
      case "mon-profil":
        return (
          <div className="grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Nom affiché
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <div className="rounded-[18px] border border-[#d7dce5] bg-white px-4 py-4">
              <div className="text-[13px] font-semibold text-[#344054]">Photo de profil</div>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                {settings.profilePhotoUrl ? (
                  <Image src={settings.profilePhotoUrl} alt={displayName} width={88} height={88} className="h-[88px] w-[88px] rounded-full object-cover" />
                ) : (
                  <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#ffe8dc] text-[34px] font-semibold text-[#ff6a00]">
                    {(displayName || initialUser.displayName).trim().charAt(0).toUpperCase() || "A"}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#222] px-5 py-2.5 text-[13px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                    {isUploadingPhoto ? "Envoi..." : "Téléverser une image"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={isUploadingPhoto}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void uploadProfilePhoto(file);
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <div className="text-[12px] leading-5 text-[#667085]">JPG, PNG ou WEBP. Taille maximale 5 Mo.</div>
                </div>
              </div>
            </div>
            <label className="text-[13px] font-semibold text-[#344054]">Bio
              <textarea value={settings.bio ?? ""} onChange={(event) => setSettings((current) => ({ ...current, bio: event.target.value }))} className="mt-2 min-h-[140px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>
        );
      case "profil-de-membre":
        return (
          <div className="grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Fonction / rôle
              <input value={settings.memberRole ?? ""} onChange={(event) => setSettings((current) => ({ ...current, memberRole: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Entreprise
              <input value={settings.companyName ?? ""} onChange={(event) => setSettings((current) => ({ ...current, companyName: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Résumé d&apos;activité
              <textarea value={settings.activitySummary ?? ""} onChange={(event) => setSettings((current) => ({ ...current, activitySummary: event.target.value }))} className="mt-2 min-h-[140px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>
        );
      case "comptes-connectes":
        return (
          <div className="grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Compte Google connecté
              <input value={settings.connectedGoogleEmail ?? ""} onChange={(event) => setSettings((current) => ({ ...current, connectedGoogleEmail: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Compte Apple connecté
              <input value={settings.connectedAppleEmail ?? ""} onChange={(event) => setSettings((current) => ({ ...current, connectedAppleEmail: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Numéro WhatsApp lié
              <input value={settings.connectedWhatsapp ?? ""} onChange={(event) => setSettings((current) => ({ ...current, connectedWhatsapp: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>
        );
      case "informations-fiscales":
        return (
          <div className="grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Raison sociale
              <input value={settings.companyName ?? ""} onChange={(event) => setSettings((current) => ({ ...current, companyName: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-[13px] font-semibold text-[#344054]">ID entreprise
                <input value={settings.businessId ?? ""} onChange={(event) => setSettings((current) => ({ ...current, businessId: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
              </label>
              <label className="text-[13px] font-semibold text-[#344054]">Numéro fiscal
                <input value={settings.taxId ?? ""} onChange={(event) => setSettings((current) => ({ ...current, taxId: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
              </label>
            </div>
            <label className="text-[13px] font-semibold text-[#344054]">Adresse de facturation
              <textarea value={settings.billingAddress ?? ""} onChange={(event) => setSettings((current) => ({ ...current, billingAddress: event.target.value }))} className="mt-2 min-h-[120px] w-full rounded-[18px] border border-[#d7dce5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>
        );
      case "modifier-mot-de-passe":
        return (
          <div className="grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Mot de passe actuel
              <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Nouveau mot de passe
              <input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Confirmation
              <input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>
        );
      case "verification-deux-etapes":
        return (
          <div className="grid gap-4">
            <ToggleField label="Activer la vérification en deux étapes" checked={settings.twoFactorEnabled} onChange={(checked) => setSettings((current) => ({ ...current, twoFactorEnabled: checked }))} />
            <label className="text-[13px] font-semibold text-[#344054]">Numéro de secours
              <input value={settings.twoFactorPhone ?? ""} onChange={(event) => setSettings((current) => ({ ...current, twoFactorPhone: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>
        );
      case "sessions-actives":
        return (
          <div className="space-y-4">
            <div className="rounded-[18px] bg-white px-4 py-4 ring-1 ring-black/5">
              <div className="text-[15px] font-semibold text-[#222]">Session actuelle</div>
              <div className="mt-2 text-[14px] leading-6 text-[#667085]">Compte: {initialUser.email}</div>
              <div className="text-[14px] leading-6 text-[#667085]">Créé le: {new Date(initialUser.createdAt).toLocaleDateString("fr-FR")}</div>
              <div className="text-[14px] leading-6 text-[#667085]">Statut: active</div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#222] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00]">
                <LogOut className="h-4 w-4" />
                Déconnecter cette session
              </button>
            </form>
          </div>
        );
      case "changer-adresse-email":
        return (
          <div className="grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Adresse actuelle
              <input value={initialUser.email} readOnly className="mt-2 h-11 w-full rounded-[14px] border border-[#e4e7ec] bg-[#f8fafc] px-4 text-[14px] text-[#667085] outline-none" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Nouvelle adresse e-mail
              <input type="email" value={emailForm.newEmail} onChange={(event) => setEmailForm((current) => ({ ...current, newEmail: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Mot de passe de confirmation
              <input type="password" value={emailForm.password} onChange={(event) => setEmailForm((current) => ({ ...current, password: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
          </div>
        );
      case "changer-numero-telephone":
        return (
          <div className="grid gap-4">
            <label className="text-[13px] font-semibold text-[#344054]">Nouveau numéro
              <input value={settings.phone ?? ""} onChange={(event) => setSettings((current) => ({ ...current, phone: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#ff6a00]" />
            </label>
            <ToggleField label="Utiliser aussi ce numéro pour WhatsApp" checked={settings.connectedWhatsapp === settings.phone && Boolean(settings.phone)} onChange={(checked) => setSettings((current) => ({ ...current, connectedWhatsapp: checked ? current.phone : "" }))} />
          </div>
        );
      case "preferences-sms":
        return (
          <div className="space-y-3">
            <ToggleField label="Alertes de sécurité" checked={settings.smsSecurityAlerts} onChange={(checked) => setSettings((current) => ({ ...current, smsSecurityAlerts: checked }))} />
            <ToggleField label="Mises à jour de commande" checked={settings.smsOrderUpdates} onChange={(checked) => setSettings((current) => ({ ...current, smsOrderUpdates: checked }))} />
            <ToggleField label="Rappels logistiques" checked={settings.smsLogisticsReminders} onChange={(checked) => setSettings((current) => ({ ...current, smsLogisticsReminders: checked }))} />
          </div>
        );
      case "confidentialite":
        return (
          <div className="space-y-3">
            <ToggleField label="Profil visible" checked={settings.privacyProfileVisible} onChange={(checked) => setSettings((current) => ({ ...current, privacyProfileVisible: checked }))} />
            <ToggleField label="Historique d'activité visible" checked={settings.privacyActivityVisible} onChange={(checked) => setSettings((current) => ({ ...current, privacyActivityVisible: checked }))} />
            <ToggleField label="Personnalisation par données d'usage" checked={settings.privacyPersonalizedData} onChange={(checked) => setSettings((current) => ({ ...current, privacyPersonalizedData: checked }))} />
          </div>
        );
      case "preferences-emails":
        return (
          <div className="space-y-3">
            <ToggleField label="E-mails de suivi de commande" checked={settings.emailOrderUpdates} onChange={(checked) => setSettings((current) => ({ ...current, emailOrderUpdates: checked }))} />
            <ToggleField label="E-mails marketing" checked={settings.emailMarketing} onChange={(checked) => setSettings((current) => ({ ...current, emailMarketing: checked }))} />
            <ToggleField label="Résumé hebdomadaire" checked={settings.emailWeeklyDigest} onChange={(checked) => setSettings((current) => ({ ...current, emailWeeklyDigest: checked }))} />
          </div>
        );
      case "preferences-publicitaires":
        return (
          <div className="grid gap-4">
            <ToggleField label="Annonces personnalisées" checked={settings.adsPersonalized} onChange={(checked) => setSettings((current) => ({ ...current, adsPersonalized: checked }))} />
            <ToggleField label="Ciblage par centres d'intérêt" checked={settings.adsInterestBased} onChange={(checked) => setSettings((current) => ({ ...current, adsInterestBased: checked }))} />
            <label className="text-[13px] font-semibold text-[#344054]">Fréquence des campagnes
              <select value={settings.adsCampaignFrequency} onChange={(event) => setSettings((current) => ({ ...current, adsCampaignFrequency: event.target.value as "faible" | "normale" | "elevee" }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] bg-white px-4 text-[14px] outline-none focus:border-[#ff6a00]">
                <option value="faible">Faible</option>
                <option value="normale">Normale</option>
                <option value="elevee">Élevée</option>
              </select>
            </label>
          </div>
        );
      case "supprimer-compte":
        return (
          <div className="grid gap-4">
            <div className="rounded-[18px] border border-[#f5c2c7] bg-[#fff5f6] px-4 py-4 text-[14px] leading-6 text-[#b42318]">
              Cette action supprime définitivement votre compte, vos adresses, vos favoris et vos données associées.
            </div>
            <label className="text-[13px] font-semibold text-[#344054]">Tapez SUPPRIMER
              <input value={deleteForm.confirmation} onChange={(event) => setDeleteForm((current) => ({ ...current, confirmation: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#c74444]" />
            </label>
            <label className="text-[13px] font-semibold text-[#344054]">Mot de passe
              <input type="password" value={deleteForm.password} onChange={(event) => setDeleteForm((current) => ({ ...current, password: event.target.value }))} className="mt-2 h-11 w-full rounded-[14px] border border-[#d7dce5] px-4 text-[14px] outline-none focus:border-[#c74444]" />
            </label>
          </div>
        );
    }
  };

  const primaryAction = slug === "modifier-mot-de-passe"
    ? submitPassword
    : slug === "changer-adresse-email"
      ? submitEmail
      : slug === "supprimer-compte"
        ? submitDelete
        : slug === "sessions-actives"
          ? undefined
          : saveSettings;

  const actionLabel = slug === "supprimer-compte"
    ? "Supprimer définitivement"
    : slug === "changer-adresse-email"
      ? "Mettre à jour l'e-mail"
      : slug === "modifier-mot-de-passe"
        ? "Mettre à jour le mot de passe"
        : "Enregistrer";

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#7b675a] sm:text-[13px]">
        <Link href="/account" className="transition hover:text-[#ff6a00]">Profil</Link>
        <span>/</span>
        <Link href="/account/compte" className="transition hover:text-[#ff6a00]">Compte</Link>
        <span>/</span>
        <span className="font-semibold text-[#221f1c]">{page.title}</span>
      </div>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_30px_rgba(24,39,75,0.05)] ring-1 ring-black/5 sm:rounded-[32px]">
        <div className="border-b border-[#ececec] px-5 py-5 sm:px-8 sm:py-7">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white sm:px-4 sm:py-2 sm:text-[13px] sm:tracking-[0.16em]" style={{ backgroundColor: page.accent }}>
            <ShieldCheck className="h-4 w-4" />
            Réglage compte
          </div>
          <h1 className="mt-3 text-[26px] font-bold tracking-[-0.05em] text-[#222] sm:mt-4 sm:text-[42px]">{page.title}</h1>
          <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#666] sm:text-[16px] sm:leading-8">{page.description}</p>
        </div>

        <div className="grid gap-5 px-4 py-4 sm:px-8 sm:py-8 xl:grid-cols-[0.88fr_1.12fr]">
          <article className="rounded-[24px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5 sm:px-6 sm:py-6">
            <div className="text-[17px] font-semibold text-[#222] sm:text-[20px]">Résumé</div>
            <div className="mt-4 space-y-3">
              {page.bullets.map((item) => (
                <div key={item} className="flex items-center justify-between rounded-[16px] bg-white px-4 py-3 text-[14px] text-[#222] ring-1 ring-black/5 sm:text-[15px]">
                  <span>{item}</span>
                  <ChevronRight className="h-4 w-4 text-[#9b9b9b]" />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[18px] bg-white px-4 py-4 ring-1 ring-black/5">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-[#127a46]">
                <CheckCircle2 className="h-4 w-4" />
                Données persistées
              </div>
              <div className="mt-2 text-[13px] leading-6 text-[#667085]">Dernière mise à jour: {new Date(settings.updatedAt).toLocaleString("fr-FR")}</div>
            </div>
          </article>

          <article className="rounded-[24px] bg-[#fafafa] px-4 py-4 ring-1 ring-black/5 sm:px-6 sm:py-6">
            <div className="text-[17px] font-semibold text-[#222] sm:text-[20px]">Formulaire</div>
            <div className="mt-4">{renderMainForm()}</div>

            {error ? <div className="mt-4 rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[13px] font-medium text-[#b42318] ring-1 ring-[#f5c2c7]">{error}</div> : null}
            {feedback ? <div className="mt-4 rounded-[16px] bg-[#effbf2] px-4 py-3 text-[13px] font-medium text-[#1f7a39] ring-1 ring-[#c8ead1]">{feedback}</div> : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {primaryAction ? (
                <button type="button" onClick={() => void primaryAction()} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:px-6 sm:text-[15px]" style={{ backgroundColor: slug === "supprimer-compte" ? "#c74444" : page.accent }}>
                  {slug === "supprimer-compte" ? <Trash2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isSaving ? "Traitement..." : actionLabel}
                </button>
              ) : null}
              <Link href="/account/compte" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#222] px-5 text-[14px] font-semibold text-[#222] transition hover:border-[#ff6a00] hover:text-[#ff6a00] sm:h-12 sm:px-6 sm:text-[15px]">
                <ArrowLeft className="h-4 w-4" />
                Retour à Compte
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}