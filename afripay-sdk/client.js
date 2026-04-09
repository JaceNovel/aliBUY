const { createProductsService } = require("./services/products");
const { createOrdersService } = require("./services/orders");

class AfriPayClient {
  constructor({
    appKey,
    appSecret,
    baseUrl = "https://api.afripay.space/api",
    timeout = 10000,
    retries = 2,
    debug = false,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (!appKey || !appSecret) {
      throw new Error("appKey and appSecret are required.");
    }

    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required. Use Node.js 18+ or provide fetchImpl.");
    }

    this.appKey = appKey;
    this.appSecret = appSecret;
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.timeout = timeout;
    this.retries = retries;
    this.debug = debug;
    this.fetch = fetchImpl;

    this.products = createProductsService(this);
    this.orders = createOrdersService(this);
  }

  async getProducts(params) {
    return this.products.getProducts(params);
  }

  async createOrder(data) {
    return this.orders.createOrder(data);
  }

  async request(pathname, options = {}) {
    const {
      method = "GET",
      query,
      body,
      timeout = this.timeout,
      retries = this.retries,
    } = options;

    const url = new URL(pathname.replace(/^\/+/, ""), `${this.baseUrl}/`);
    if (query && typeof query === "object") {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && `${value}`.trim() !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let attempt = 0;
    let lastError;

    while (attempt <= retries) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error("Request timeout")), timeout);

      try {
        this.log("request", { method, url: url.toString(), attempt: attempt + 1 });

        const response = await this.fetch(url.toString(), {
          method,
          headers: {
            "X-APP-KEY": this.appKey,
            "X-APP-SECRET": this.appSecret,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const raw = await response.text();
        const payload = raw ? safeParseJson(raw) : null;

        if (!response.ok) {
          const message = payload && typeof payload === "object" && payload && typeof payload.message === "string"
            ? payload.message
            : `AfriPay API request failed with status ${response.status}`;

          throw new Error(message);
        }

        this.log("response", { method, url: url.toString(), status: response.status });
        return payload;
      } catch (error) {
        lastError = error;
        this.log("error", {
          method,
          url: url.toString(),
          attempt: attempt + 1,
          message: error instanceof Error ? error.message : String(error),
        });

        if (attempt >= retries || !shouldRetry(error)) {
          throw normalizeError(error);
        }

        await delay((attempt + 1) * 300);
        attempt += 1;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw normalizeError(lastError);
  }

  log(stage, payload) {
    if (!this.debug) {
      return;
    }

    console.debug(`[AfriPay SDK] ${stage}`, payload);
  }
}

function safeParseJson(input) {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function shouldRetry(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("timeout") || message.includes("fetch") || message.includes("network") || message.includes("5");
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

module.exports = {
  AfriPayClient,
};