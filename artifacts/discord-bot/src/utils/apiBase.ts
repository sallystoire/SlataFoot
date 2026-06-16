export function getApiBase(): string {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS}`;
  return "http://localhost:8080";
}
