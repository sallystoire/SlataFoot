import { eq } from "drizzle-orm";
import { db, settingsTable } from "../db.js";

export async function getOrCreateSettings(guildId: string) {
  await db
    .insert(settingsTable)
    .values({
      guildId,
      voiceCoinsInterval: 10,
      voiceCoinsAmount: 5,
      chatCoinsAmount: 1,
    })
    .onConflictDoNothing();

  const existing = await db.query.settingsTable.findFirst({
    where: eq(settingsTable.guildId, guildId),
  });

  return existing!;
}
