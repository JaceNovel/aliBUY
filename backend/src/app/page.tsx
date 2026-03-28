const apiExamples = [
  "/api/products",
  "/api/pricing-context",
  "/api/search-suggestions",
  "/api/admin/aliexpress/dashboard",
  "/api/payments/moneroo/webhook",
  "/api/health",
];

export default function BackendHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "48px 20px",
        background: "linear-gradient(180deg, #f5f7fb 0%, #eef2f7 100%)",
        color: "#111827",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #dbe2ea",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <p
          style={{
            margin: 0,
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            background: "#dcfce7",
            color: "#166534",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Backend online
        </p>

        <h1 style={{ margin: "18px 0 12px", fontSize: 36, lineHeight: 1.1 }}>
          AliBUY backend is deployed.
        </h1>

        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: "#4b5563" }}>
          This Vercel project hosts the API and admin backend. It does not serve the storefront homepage.
          Use the API routes below or deploy the separate frontend Vercel project for the customer-facing site.
        </p>

        <div style={{ marginTop: 28 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Useful routes</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            {apiExamples.map((path) => (
              <li key={path}>
                <a href={path} style={{ color: "#0f766e", textDecoration: "none", fontWeight: 600 }}>
                  {path}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}