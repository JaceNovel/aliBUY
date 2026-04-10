import "server-only";

const GOOGLE_OAUTH_STATE_COOKIE = "afripay_google_oauth_state";
const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

type GoogleOauthMode = "login" | "register";

type GoogleOauthStatePayload = {
  v: 1;
  mode: GoogleOauthMode;
  nextPath: string;
  nonce: string;
  iat: number;
  exp: number;
};

function getUserSessionSecret() {
  return process.env.USER_SESSION_SECRET?.trim() || process.env.APP_KEY?.trim() || "";
}

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || "";
}

function getGoogleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
}

function encoder() {
  return new TextEncoder();
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(payload: string) {
  const secret = getUserSessionSecret();
  if (!secret) {
    throw new Error("Configuration OAuth Google incomplète. Définissez USER_SESSION_SECRET ou APP_KEY.");
  }

  return sha256Hex(`${payload}.${secret}`);
}

function normalizeGoogleOauthMode(value?: string | null): GoogleOauthMode {
  return value === "register" ? "register" : "login";
}

export function getGoogleOauthStateCookieName() {
  return GOOGLE_OAUTH_STATE_COOKIE;
}

export function getGoogleOauthStateCookieConfig() {
  return {
    name: GOOGLE_OAUTH_STATE_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

export function isGoogleOauthConfigured() {
  return Boolean(getGoogleClientId()) && Boolean(getGoogleClientSecret());
}

export function getSafeNextPath(nextPath?: string | null) {
  if (typeof nextPath === "string" && nextPath.startsWith("/")) {
    return nextPath;
  }

  return "/account";
}

function getGoogleOauthCallbackUrl(request: Request) {
  const configuredUrl = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  const requestUrl = new URL(request.url);
  return `${requestUrl.origin}/api/auth/google/callback`;
}

export async function createGoogleOauthState(input: { nextPath?: string | null; mode?: string | null }) {
  const nextPath = getSafeNextPath(input.nextPath);
  const mode = normalizeGoogleOauthMode(input.mode);
  const issuedAt = Math.floor(Date.now() / 1000);

  const payload: GoogleOauthStatePayload = {
    v: 1,
    mode,
    nextPath,
    nonce: crypto.randomUUID(),
    iat: issuedAt,
    exp: issuedAt + GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function parseGoogleOauthState(state?: string | null) {
  if (!state) {
    return null;
  }

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await signPayload(encodedPayload).catch(() => null);
  if (!expectedSignature || expectedSignature !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as GoogleOauthStatePayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.v !== 1 || !payload.nonce || payload.exp <= now) {
      return null;
    }

    return {
      mode: normalizeGoogleOauthMode(payload.mode),
      nextPath: getSafeNextPath(payload.nextPath),
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

export async function buildGoogleOauthAuthorizeUrl(request: Request, input: { nextPath?: string | null; mode?: string | null }) {
  const clientId = getGoogleClientId();
  if (!clientId || !getGoogleClientSecret()) {
    throw new Error("OAuth Google indisponible. Ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.");
  }

  const state = await createGoogleOauthState(input);
  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", getGoogleOauthCallbackUrl(request));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");
  authorizeUrl.searchParams.set("include_granted_scopes", "true");

  return { authorizeUrl, state };
}

export async function exchangeGoogleOauthCode(request: Request, code: string) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("OAuth Google indisponible. Ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleOauthCallbackUrl(request),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const tokenPayload = await tokenResponse.json().catch(() => null) as { access_token?: string; error?: string; error_description?: string } | null;
  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(tokenPayload?.error_description || "Connexion Google impossible.");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      authorization: `Bearer ${tokenPayload.access_token}`,
    },
    cache: "no-store",
  });
  const profile = await profileResponse.json().catch(() => null) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
  } | null;

  if (!profileResponse.ok || !profile?.email) {
    throw new Error("Profil Google introuvable.");
  }

  if (profile.email_verified === false) {
    throw new Error("Validez d'abord l'adresse e-mail de votre compte Google.");
  }

  return {
    googleUserId: profile.sub?.trim() || null,
    email: profile.email.trim().toLowerCase(),
    displayName: profile.name?.trim() || profile.given_name?.trim() || profile.email.split("@")[0] || "Client AfriPay",
  };
}