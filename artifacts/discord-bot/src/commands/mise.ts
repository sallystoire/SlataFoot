import { EmbedBuilder, type Message } from "discord.js";
import { eq } from "drizzle-orm";
import { db, betsTable, matchesTable, scorersTable, usersTable, settingsTable } from "../db.js";
import { getOrCreateUser } from "../utils/getOrCreateUser.js";
import { updateLiveEmbed } from "../utils/liveEmbed.js";

export async function miseCommand(message: Message, args: string[]) {
  if (args.length < 2) {
    return message.reply(
      "❌ Usage : `-mise [équipe/buteur/nul] [montant]`\nExemple : `-mise Portugal 100` ou `-mise Ronaldo 50`"
    );
  }

  const amountStr = args[args.length - 1];
  const betValue = args.slice(0, args.length - 1).join(" ");
  const amount = parseInt(amountStr, 10);

  if (isNaN(amount) || amount <= 0) {
    return message.reply("❌ Le montant doit être un nombre positif.");
  }

  const user = await getOrCreateUser(message.author);

  if (user.coins < amount) {
    return message.reply(
      `❌ Tu n'as pas assez de coins ! Tu as **${user.coins} 🪙** mais tu essaies de miser **${amount} 🪙**.`
    );
  }

  const matches = await db.query.matchesTable.findMany({
    where: eq(matchesTable.status, "upcoming"),
  });

  if (matches.length === 0) {
    return message.reply("❌ Aucun match disponible en ce moment.");
  }

  let foundMatch = null;
  let betType = "";
  let odds = 0;
  let resolvedBetValue = betValue;

  const betValueLower = betValue.toLowerCase().trim();

  for (const match of matches) {
    if (
      match.homeTeam.toLowerCase() === betValueLower ||
      match.homeTeam.toLowerCase().includes(betValueLower)
    ) {
      foundMatch = match;
      betType = "home";
      odds = match.homeOdds;
      resolvedBetValue = match.homeTeam;
      break;
    }
    if (
      match.awayTeam.toLowerCase() === betValueLower ||
      match.awayTeam.toLowerCase().includes(betValueLower)
    ) {
      foundMatch = match;
      betType = "away";
      odds = match.awayOdds;
      resolvedBetValue = match.awayTeam;
      break;
    }
    if (betValueLower === "nul" || betValueLower === "match nul" || betValueLower === "draw") {
      foundMatch = match;
      betType = "draw";
      odds = match.drawOdds;
      resolvedBetValue = "Match Nul";
      break;
    }
  }

  if (!foundMatch) {
    const scorers = await db.query.scorersTable.findMany();
    for (const scorer of scorers) {
      if (
        scorer.playerName.toLowerCase() === betValueLower ||
        scorer.playerName.toLowerCase().includes(betValueLower)
      ) {
        const match = matches.find((m) => m.id === scorer.matchId);
        if (match) {
          foundMatch = match;
          betType = "scorer";
          odds = scorer.odds;
          resolvedBetValue = scorer.playerName;
          break;
        }
      }
    }
  }

  if (!foundMatch) {
    return message.reply(
      `❌ Équipe, buteur ou résultat **"${betValue}"** introuvable.\nUtilise \`-matchs\` pour voir les options disponibles.`
    );
  }

  const potentialWin = Math.floor(amount * odds);

  await db.update(usersTable).set({ coins: user.coins - amount }).where(eq(usersTable.id, user.id));
  await db.insert(betsTable).values({
    userId: user.id,
    matchId: foundMatch.id,
    betType,
    betValue: resolvedBetValue,
    amount,
    odds,
    potentialWin,
    status: "pending",
  });
  await db.update(usersTable).set({ totalTickets: user.totalTickets + 1 }).where(eq(usersTable.id, user.id));

  const embed = new EmbedBuilder()
    .setTitle("🎰 Pari enregistré !")
    .setColor(0x2ecc71)
    .addFields(
      { name: "⚽ Match", value: `${foundMatch.homeTeamEmoji} ${foundMatch.homeTeam} vs ${foundMatch.awayTeamEmoji} ${foundMatch.awayTeam}`, inline: false },
      { name: "🎯 Pari sur", value: resolvedBetValue, inline: true },
      { name: "💰 Mise", value: `${amount} 🪙`, inline: true },
      { name: "📈 Cote", value: `x${odds.toFixed(2)}`, inline: true },
      { name: "🏆 Gain potentiel", value: `**${potentialWin} 🪙**`, inline: true },
      { name: "💳 Solde restant", value: `${user.coins - amount} 🪙`, inline: true },
    )
    .setFooter({ text: "Bonne chance ! 🍀" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });

  if (message.guild) {
    updateLiveEmbed(message.client, message.guild.id).catch(() => {});

    const settings = await db.query.settingsTable.findFirst({
      where: eq(settingsTable.guildId, message.guild.id),
    });
    if (settings?.liveChannelId) {
      try {
        const { TextChannel } = await import("discord.js");
        const channel = message.client.channels.cache.get(settings.liveChannelId);
        if (channel && channel.isTextBased()) {
          await (channel as import("discord.js").TextChannel).send(
            `<@${message.author.id}> a misé **${amount} 🪙** sur **${resolvedBetValue}** — cote x${odds.toFixed(2)} 🎰`
          );
        }
      } catch {}
    }
  }
}
