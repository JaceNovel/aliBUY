type EnvConfig = {
  databaseUrl: string;
  appUrl: string;
  frontendOrigin: string;
  allowedOrigins: string[];
  monerooApiUrl: string;
  monerooSecretKey: string;
  monerooWebhookSecret: string;
  fedapayApiUrl: string;
  fedapayApiKey: string;
  paypalApiUrl: string;
  paypalEnvironment: string;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalFallbackCurrency: string;
  paypalXofPerEur: string;
  paymentWebhookSecret: string;
  adminApiToken: string;
};

function getEnv(name: string, fallback = ""): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env: EnvConfig = {
  get databaseUrl() {
    return getEnv("DATABASE_URL");
  },
  get appUrl() {
    return getOptionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
  },
  get frontendOrigin() {
    return getOptionalEnv("FRONTEND_ORIGIN", "http://localhost:3000");
  },
  get allowedOrigins() {
    return getOptionalEnv("ALLOWED_ORIGINS", "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  },
  get monerooApiUrl() {
    return getOptionalEnv("MONEROO_API_BASE_URL", getOptionalEnv("MONEROO_API_URL", "https://api.moneroo.io"));
  },
  get monerooSecretKey() {
    return getOptionalEnv("MONEROO_SECRET_KEY", getOptionalEnv("MONEROO_API_KEY", ""));
  },
  get monerooWebhookSecret() {
    return getOptionalEnv("MONEROO_WEBHOOK_SECRET", getOptionalEnv("PAYMENT_WEBHOOK_SECRET", ""));
  },
  get fedapayApiUrl() {
    return getOptionalEnv("FEDAPAY_API_URL", "https://api.fedapay.example");
  },
  get fedapayApiKey() {
    return getOptionalEnv("FEDAPAY_API_KEY", "replace-me");
  },
  get paypalApiUrl() {
    return getOptionalEnv("PAYPAL_API_BASE_URL", "");
  },
  get paypalEnvironment() {
    return getOptionalEnv("PAYPAL_ENVIRONMENT", "sandbox");
  },
  get paypalClientId() {
    return getOptionalEnv("PAYPAL_CLIENT_ID", "");
  },
  get paypalClientSecret() {
    return getOptionalEnv("PAYPAL_CLIENT_SECRET", "");
  },
  get paypalFallbackCurrency() {
    return getOptionalEnv("PAYPAL_FALLBACK_CURRENCY", "EUR");
  },
  get paypalXofPerEur() {
    return getOptionalEnv("PAYPAL_XOF_PER_EUR", "655.957");
  },
  get paymentWebhookSecret() {
    return getOptionalEnv("PAYMENT_WEBHOOK_SECRET", "replace-me");
  },
  get adminApiToken() {
    return getOptionalEnv("ADMIN_API_TOKEN", "");
  },
};