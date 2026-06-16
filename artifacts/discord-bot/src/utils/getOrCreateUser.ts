import { eq } from "drizzle-orm";
import { db, usersTable } from "../db.js";
import { generateReferralCode } from "./referral.js";
import type { GuildMember, User as DJSUser } from "discord.js";

export async function getOrCreateUser(discordUser: DJSUser | GuildMember) {
  const user = "user" in discordUser ? discordUser.user : discordUser;
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.discordId, user.id),
  });
  if (existing) return existing;

  const referralCode = generateReferralCode(user.id);
  const [created] = await db
    .insert(usersTable)
    .values({
      discordId: user.id,
      username: user.username,
      coins: 100,
      xp: 0,
      totalTickets: 0,
      wonBets: 0,
      lostBets: 0,
      referralCode,
      referralCount: 0,
      usedReferralCode: false,
      isStreaming: false,
      hasCamera: false,
    })
    .returning();
  return created;
}
