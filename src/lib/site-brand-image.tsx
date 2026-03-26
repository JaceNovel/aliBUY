import { readFileSync } from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site-config";

const logoPath = path.join(process.cwd(), "public", "WhatsApp_Image_2026-03-22_at_03.03.05-removebg-preview.png");
const logoDataUri = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;

export function createSiteBrandImageResponse(input: {
  width: number;
  height: number;
  showText?: boolean;
}) {
  const showText = input.showText ?? true;
  const logoWidth = showText
    ? Math.min(760, Math.round(input.width * 0.62))
    : Math.min(Math.round(input.width * 0.74), Math.round(input.height * 0.74));

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "radial-gradient(circle at top left, rgba(255,106,0,0.22), transparent 32%), radial-gradient(circle at bottom right, rgba(255,77,0,0.18), transparent 28%), #000000",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 24,
            display: "flex",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 40,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            padding: 48,
          }}
        >
          <img
            src={logoDataUri}
            width={logoWidth}
            height={logoWidth}
            alt={`${SITE_NAME} logo`}
            style={{ objectFit: "contain" }}
          />
          {showText ? (
            <div
              style={{
                display: "flex",
                fontSize: 42,
                fontWeight: 700,
                color: "rgba(255,255,255,0.92)",
                letterSpacing: -1.2,
              }}
            >
              Import Alibaba, logistique et paiements unifiés
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: input.width,
      height: input.height,
    },
  );
}