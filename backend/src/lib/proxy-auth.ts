import { createAuthenticatedUserSession, getCurrentUser } from "@/lib/user-auth";
import { USER_SESSION_COOKIE } from "@/lib/user-session";

function upsertCookieHeader(cookieHeader: string | undefined, name: string, value: string) {
  const encodedValue = encodeURIComponent(value);
  const nextPair = `${name}=${encodedValue}`;

  if (!cookieHeader) {
    return nextPair;
  }

  const segments = cookieHeader
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !segment.startsWith(`${name}=`));

  return [...segments, nextPair].join("; ");
}

export async function buildAuthenticatedProxyHeaders(request: Request, initialHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    ...(initialHeaders ?? {}),
  };

  for (const headerName of ["cookie", "origin", "referer", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "user-agent", "x-forwarded-for", "x-real-ip", "x-forwarded-proto", "x-forwarded-host"]) {
    const value = request.headers.get(headerName);
    if (value) {
      headers[headerName] = value;
    }
  }

  try {
    const user = await getCurrentUser();
    if (user) {
      const token = await createAuthenticatedUserSession(user);
      headers.cookie = upsertCookieHeader(headers.cookie, USER_SESSION_COOKIE, token);
    }
  } catch {
    // Preserve the original proxy request even if local auth resolution fails.
  }

  return headers;
}