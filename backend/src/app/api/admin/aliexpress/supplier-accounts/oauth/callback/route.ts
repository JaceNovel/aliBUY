export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/api/admin/aliexpress/oauth/callback", url.origin);

  for (const [key, value] of url.searchParams.entries()) {
    target.searchParams.append(key, value);
  }

  return Response.redirect(target, 302);
}
