"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { getApiKeys } from "@/lib/api";

export default function DashboardSettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    getApiKeys().then((payload) => {
      if (alive) {
        setWebhookUrl(payload.webhookUrl);
      }
    }).catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <div className="text-sm uppercase tracking-[0.24em] text-[#818cf8]">Settings</div>
        <h2 className="mt-2 text-[30px] font-black tracking-[-0.05em] text-white">Configuration webhook</h2>
      </section>

      <section className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="space-y-4">
          <Input
            label="Webhook URL"
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://partner.example.com/webhooks/afripay"
            hint="Reçoit les événements partner comme order.paid."
          />
          <div className="flex items-center gap-3">
            <Button onClick={() => {
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1800);
            }}>
              Update
            </Button>
            {saved ? <span className="text-sm font-medium text-[#86efac]">Configuration mise à jour.</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}