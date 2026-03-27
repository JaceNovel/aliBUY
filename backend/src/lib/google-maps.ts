export function extractCoordinatesFromGoogleMapsUrl(value: string) {
  const normalized = decodeURIComponent(value.trim());

  const queryMatch = normalized.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  if (queryMatch) {
    return { latitude: Number(queryMatch[1]), longitude: Number(queryMatch[2]) };
  }

  const atMatch = normalized.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  if (atMatch) {
    return { latitude: Number(atMatch[1]), longitude: Number(atMatch[2]) };
  }

  const dataMatch = normalized.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (dataMatch) {
    return { latitude: Number(dataMatch[1]), longitude: Number(dataMatch[2]) };
  }

  return null;
}

export function isGoogleMapsShortUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    return hostname === "maps.app.goo.gl" || hostname === "goo.gl";
  } catch {
    return false;
  }
}