export const providers = ["Google Meet", "Zoom", "Microsoft Teams"] as const;
export function validMeetingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      value.length > 2048
    )
      return false;
    const host = url.hostname.toLowerCase();
    if (
      [...url.searchParams.keys()].some((k) =>
        /^(url|redirect|redirect_uri|redirect_url|next|return|returnurl|continue)$/i.test(
          k,
        ),
      )
    )
      return false;
    if (host === "meet.google.com")
      return /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname);
    if (host === "zoom.us" || /^[a-z0-9-]+\.zoom\.us$/.test(host))
      return /^\/(j|my)\/[a-zA-Z0-9._-]+\/?$/.test(url.pathname);
    return (
      (host === "teams.microsoft.com" || host === "teams.live.com") &&
      /^\/(l\/meetup-join|meet)\/.+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
export function providerMatches(url: string, provider: string) {
  if (!validMeetingUrl(url)) return false;
  const host = new URL(url).hostname;
  return provider === "Google Meet"
    ? host === "meet.google.com"
    : provider === "Zoom"
      ? host === "zoom.us" || host.endsWith(".zoom.us")
      : provider === "Microsoft Teams" &&
        (host === "teams.microsoft.com" || host === "teams.live.com");
}
