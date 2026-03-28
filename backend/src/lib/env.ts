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
  paymentWebhookSecret: string;
  alibabaAppKey: string;
  alibabaAppSecret: string;
  alibabaAccessToken: string;
  adminApiToken: string;
  alibabaMappingPath: string;
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
  get paymentWebhookSecret() {
    return getOptionalEnv("PAYMENT_WEBHOOK_SECRET", "replace-me");
  },
  get alibabaAppKey() {
    return getOptionalEnv("ALIBABA_APP_KEY", "replace-me");
  },
  get alibabaAppSecret() {
    return getOptionalEnv("ALIBABA_APP_SECRET", "replace-me");
  },
  get alibabaAccessToken() {
    return getOptionalEnv("ALIBABA_ACCESS_TOKEN", "replace-me");
  },
  get adminApiToken() {
    return getOptionalEnv("ADMIN_API_TOKEN", "");
  },
  get alibabaMappingPath() {
    return getOptionalEnv("ALIBABA_MAPPING_PATH", `${process.cwd()}/../data/sourcing/catalog-mapping.json`);
  },
};