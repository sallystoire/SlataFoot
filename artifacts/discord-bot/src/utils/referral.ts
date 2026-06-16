export function generateReferralCode(discordId: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  const seed = discordId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < 8; i++) {
    code += chars[(seed * (i + 7) * 31 + i * 17) % chars.length];
  }
  return code;
}
