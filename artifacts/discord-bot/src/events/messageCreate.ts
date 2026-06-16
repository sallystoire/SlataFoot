import { type Message } from "discord.js";
import { eq } from "drizzle-orm";
import { db, usersTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { getOrCreateSettings } from "../utils/settings.js";

export async function handleMessageCreate(message: Message) {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.content.startsWith("/")) return;

  const settings = await getOrCreateSettings(message.guild.id);
  const user = await getOrCreateUser(message.author);
  if (!user) return;
  await db.update(usersTable).set({
    coins: user.coins + settings.chatCoinsAmount,
    xp: user.xp + 1,
    username: message.author.username,
  }).where(eq(usersTable.discordId, message.author.id));
}
