"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

type LiveCountdownBadgeProps = {
  endsAt: string;
  prefix: string;
  className: string;
  iconClassName?: string;
};

function formatRemainingTime(endsAt: string, now = Date.now()) {
  const targetTime = new Date(endsAt).getTime();
  const deltaMs = Math.max(0, targetTime - now);
  const totalSeconds = Math.floor(deltaMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function LiveCountdownBadge({
  endsAt,
  prefix,
  className,
  iconClassName,
}: LiveCountdownBadgeProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      setNow(Date.now());
    }, 0);

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(timer);
    };
  }, [endsAt]);

  const remaining = now === null ? "--:--:--" : formatRemainingTime(endsAt, now);

  return (
    <div className={className}>
      <Clock3 className={iconClassName ?? "h-6 w-6"} />
      {prefix} {remaining}
    </div>
  );
}