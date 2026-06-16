import { eq } from "drizzle-orm";
import { db, settingsTable } from "../db.js";

export async function getOrCreateSettings(guildId: string) {
  const existing = await db.query.settingsTable.findFirst({
    where: eq(settingsTable.guildId, guildId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(settingsTable)
    .values({
      guildId,
      voiceCoinsInterval: 10,
      voiceCoinsAmount: 5,
      chatCoinsAmount: 1,
    })
    .returning();
  return created;
}
