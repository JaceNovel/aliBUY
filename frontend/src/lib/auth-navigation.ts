export function getSafeNextPath(nextPath?: string | null) {
  if (typeof nextPath === "string" && nextPath.startsWith("/")) {
    return nextPath;
  }

  return "/account";
}
