export function buildShareLink(token: string) {
  const baseUrl = process.env.SHARE_BASE_URL?.trim() || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/s/${token}`;
}
