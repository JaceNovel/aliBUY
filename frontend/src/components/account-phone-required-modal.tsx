"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Phone, ShieldCheck } from "lucide-react";

type SettingsSnapshot = Record<string, unknown> & {
  phone?: string;
  connectedWhatsapp?: string;
};

type AccountSettingsResponse = {
  settings?: SettingsSnapshot;
};

function normalizePhone(value: string) {
  return value.trim();
}

function isValidPhone(value: string) {
  const normalized = normalizePhone(value);
  if (normalized.length < 8) {
    return false;
  }

  return /^[+\d\s().-]+$/.test(normalized);
}

export function AccountPhoneRequiredModal() {
  const pathname = usePathname();
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [useForWhatsapp, setUseForWhatsapp] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsSnapshot, setSettingsSnapshot] = useState<SettingsSnapshot | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return undefined;
    }

    const controller = new AbortController();

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/account/settings", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (response.status === 401) {
          setIsOpen(false);
          setSettingsSnapshot(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Impossible de verifier le numero de telephone.");
        }

        const payload = await response.json() as AccountSettingsResponse;
        const settings = payload.settings ?? {};
        const existingPhone = typeof settings.phone === "string" ? normalizePhone(settings.phone) : "";
        const existingWhatsapp = typeof settings.connectedWhatsapp === "string" ? normalizePhone(settings.connectedWhatsapp) : "";

        setSettingsSnapshot(settings);
        setPhone((current) => current || existingPhone || existingWhatsapp);
        setUseForWhatsapp(existingWhatsapp ? existingWhatsapp === (existingPhone || existingWhatsapp) : true);
        setIsOpen(existingPhone.length === 0);
        setErrorMessage(null);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setIsOpen(false);
        }
      }
    };

    void loadSettings();

    return () => {
      controller.abort();
    };
  }, [isHydrated, pathname]);

  const accountSettingsHref = useMemo(() => "/account/compte/changer-numero-telephone", []);

  const handleSubmit = () => {
    const normalizedPhone = normalizePhone(phone);

    if (!isValidPhone(normalizedPhone)) {
      setErrorMessage("Ajoute un numero valide avec au moins 8 caracteres.");
      return;
    }

    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/account/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ...(settingsSnapshot ?? {}),
            phone: normalizedPhone,
            connectedWhatsapp: useForWhatsapp ? normalizedPhone : "",
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setErrorMessage(typeof payload?.message === "string" ? payload.message : "Impossible d'enregistrer ce numero.");
          return;
        }

        setIsOpen(false);
        setSettingsSnapshot(payload?.settings ?? {
          ...(settingsSnapshot ?? {}),
          phone: normalizedPhone,
          connectedWhatsapp: useForWhatsapp ? normalizedPhone : "",
        });
        router.refresh();
      })();
    });
  };

  if (!isHydrated || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#0f172a]/50 px-4 py-6 backdrop-blur-[3px]">
      <div className="w-full max-w-[540px] rounded-[28px] border border-[#f0d7c2] bg-[linear-gradient(180deg,#fff8f2_0%,#ffffff_100%)] p-6 shadow-[0_30px_90px_rgba(15,23,42,0.28)] sm:p-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1e7] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dd5b00]">
          <ShieldCheck className="h-4 w-4" />
          Numero requis
        </div>

        <h2 className="mt-4 text-[28px] font-black tracking-[-0.05em] text-[#1f2937]">
          Ajoute ton numero pour activer les automatisations
        </h2>
        <p className="mt-3 text-[14px] leading-6 text-[#667085]">
          Nous avons besoin d&apos;un numero de telephone pour les confirmations, les relances panier et les messages utiles lies a tes commandes. Tu pourras toujours le modifier plus tard dans les parametres du compte.
        </p>

        <div className="mt-5 rounded-[22px] border border-[#e7d5c8] bg-white/90 p-4">
          <label className="block text-[13px] font-semibold text-[#344054]">
            Numero de telephone
            <div className="relative mt-2">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+228 90 00 00 00"
                className="h-12 w-full rounded-[16px] border border-[#d7dce5] bg-white pl-11 pr-4 text-[15px] text-[#101828] outline-none transition focus:border-[#ff6a00]"
              />
            </div>
          </label>

          <label className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#edf1f6] bg-[#fbfcfd] px-4 py-3 text-[13px] leading-5 text-[#475467]">
            <input
              type="checkbox"
              checked={useForWhatsapp}
              onChange={(event) => setUseForWhatsapp(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] text-[#ff6a00] focus:ring-[#ff6a00]"
            />
            <span>Utiliser aussi ce numero pour WhatsApp et les automatisations de suivi.</span>
          </label>

          {errorMessage ? (
            <div className="mt-3 rounded-[14px] border border-[#f4c7c7] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#b42318]">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={accountSettingsHref}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#d7dce5] px-5 text-[14px] font-semibold text-[#344054] transition hover:border-[#ff6a00] hover:text-[#ff6a00]"
          >
            Ouvrir les parametres
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#ff6a00] px-6 text-[14px] font-semibold text-white transition hover:bg-[#e55e00] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? "Enregistrement..." : "Enregistrer le numero"}
          </button>
        </div>
      </div>
    </div>
  );
}
