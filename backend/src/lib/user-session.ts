export const USER_SESSION_COOKIE = "afripay_user_session";

const USER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type UserSessionPayload = {
  v: 1;
  sub: string;
  email: string;
  displayName: string;
  firstName: string;
  iat: number;
  exp: number;
};

function encoder() {
  return new TextEncoder();
}

function decoder() {
  return new TextDecoder();
}

function toBase64Url(value: string) {
  const bytes = encoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return decoder().decode(bytes);
}

function base64UrlEncodeJson(value: unknown) {
  return toBase64Url(JSON.stringify(value));
}

function base64UrlDecodeJson<T>(value: string) {
  return JSON.parse(fromBase64Url(value)) as T;
}

function normalizeDisplayName(displayName: string) {
  return displayName.trim().replace(/\s+/g, " ");
}

function deriveFirstName(displayName: string) {
  const normalized = normalizeDisplayName(displayName);
  const [firstName] = normalized.split(" ");
  return firstName || normalized || "Client";
}

function getUserSessionSecret() {
  return process.env.USER_SESSION_SECRET?.trim() || process.env.APP_KEY?.trim() || "";
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(payload: string) {
  if (!getUserSessionSecret()) {
    throw new Error("Configuration session utilisateur incomplète. Définissez USER_SESSION_SECRET ou APP_KEY.");
  }

  return sha256Hex(`${payload}.${getUserSessionSecret()}`);
}

export function getUserSessionMaxAgeSeconds() {
  return USER_SESSION_MAX_AGE_SECONDS;
}

export async function createUserSessionToken(input: {
  id: string;
  email: string;
  displayName: string;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: UserSessionPayload = {
    v: 1,
    sub: input.id,
    email: input.email.trim().toLowerCase(),
    displayName: normalizeDisplayName(input.displayName),
    firstName: deriveFirstName(input.displayName),
    iat: issuedAt,
    exp: issuedAt + USER_SESSION_MAX_AGE_SECONDS,
  };

  const encodedPayload = base64UrlEncodeJson(payload);
  const signature = await signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function parseUserSessionToken(token?: string | null) {
  if (!token || !getUserSessionSecret()) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await signPayload(encodedPayload);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = base64UrlDecodeJson<UserSessionPayload>(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (payload.v !== 1 || !payload.sub || !payload.email || !payload.displayName || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getDisplayInitial(displayName: string) {
  const normalized = normalizeDisplayName(displayName);
  return normalized.charAt(0).toUpperCase() || "C";
}

export function getMaskedEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) {
    return normalized;
  }

  if (localPart.length <= 3) {
    return `${localPart.charAt(0)}***@${domain}`;
  }

  return `${localPart.slice(0, 3)}***@${domain}`;
}

export function parseDisplayName(displayName: string) {
  return {
    displayName: normalizeDisplayName(displayName),
    firstName: deriveFirstName(displayName),
  };
}