import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site-config";

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
          <div
            style={{
              width: logoWidth,
              height: logoWidth,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: Math.round(logoWidth * 0.24),
              background: "linear-gradient(145deg, #ff7a1a 0%, #ff5a00 55%, #c93200 100%)",
              boxShadow: "0 28px 80px rgba(255,106,0,0.28), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                lineHeight: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: Math.round(logoWidth * 0.24),
                  fontWeight: 800,
                  letterSpacing: -2,
                }}
              >
                AF
              </div>
              <div
                style={{
                  display: showText ? "flex" : "none",
                  marginTop: Math.max(12, Math.round(logoWidth * 0.025)),
                  fontSize: Math.max(18, Math.round(logoWidth * 0.065)),
                  fontWeight: 600,
                  letterSpacing: 6,
                }}
              >
                PAY
              </div>
            </div>
          </div>
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