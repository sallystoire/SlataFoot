import { type Message } from "discord.js";
import { db, usersTable, settingsTable } from "../db.js";
import { eq } from "drizzle-orm";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { getOrCreateSettings } from "../utils/settings.js";
import { helpCommand } from "../commands/help.js";
import { matchsCommand } from "../commands/matchs.js";
import { buteurCommand } from "../commands/buteur.js";
import { miseCommand } from "../commands/mise.js";
import { ticketCommand } from "../commands/ticket.js";
import { profileCommand } from "../commands/profile.js";
import { parrainageCommand, codeCommand } from "../commands/parrainage.js";
import { liveCommand } from "../commands/live.js";
import { settingsCommand } from "../commands/settings.js";
import { addmatchCommand, addbuteurCommand, resultatCommand } from "../commands/addmatch.js";

const PREFIX = "-";

export async function handleMessageCreate(message: Message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const settings = await getOrCreateSettings(message.guild.id);

  if (!message.content.startsWith(PREFIX)) {
    const user = await getOrCreateUser(message.author);
    await db.update(usersTable).set({
      coins: user.coins + settings.chatCoinsAmount,
      xp: user.xp + 1,
    }).where(eq(usersTable.discordId, message.author.id));
    return;
  }

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  try {
    switch (command) {
      case "help":
        await helpCommand(message);
        break;
      case "matchs":
      case "matchs":
        await matchsCommand(message);
        break;
      case "buteur":
      case "buteurs":
        await buteurCommand(message);
        break;
      case "mise":
        await miseCommand(message, args);
        break;
      case "ticket":
      case "tickets":
        await ticketCommand(message);
        break;
      case "profile":
      case "profil":
        await profileCommand(message);
        break;
      case "parrainage":
        await parrainageCommand(message);
        break;
      case "code":
        await codeCommand(message, args);
        break;
      case "live":
        await liveCommand(message);
        break;
      case "settings":
        await settingsCommand(message, args);
        break;
      case "addmatch":
        await addmatchCommand(message, args);
        break;
      case "addbuteur":
        await addbuteurCommand(message, args);
        break;
      case "resultat":
        await resultatCommand(message, args);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[Command Error] ${command}:`, err);
    await message.reply("❌ Une erreur est survenue. Réessaie plus tard.").catch(() => {});
  }
}
