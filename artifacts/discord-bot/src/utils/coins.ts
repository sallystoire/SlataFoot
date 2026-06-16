export function xpToNextLevel(xp: number): { level: number; progress: number; needed: number } {
  const level = Math.floor(xp / 100);
  const progress = xp % 100;
  const needed = 100;
  return { level, progress, needed };
}

export function formatCoins(amount: number): string {
  return `**${amount.toLocaleString("fr-FR")} 🪙**`;
}
