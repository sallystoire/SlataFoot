import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
} from "discord.js";
import { db, matchesTable } from "../db.js";
import { eq } from "drizzle-orm";

const API_BASE = `https://${process.env.REPLIT_DOMAINS}`;

export async function matchsCommand(message: Message) {
  const matches = await db.query.matchesTable.findMany({
    where: eq(matchesTable.status, "upcoming"),
    orderBy: (m, { asc }) => [asc(m.matchDate)],
  });

  if (matches.length === 0) {
    return message.reply(
      "❌ Aucun match disponible. Un admin peut en ajouter avec `-addmatch`."
    );
  }

  const sentMsg = await message.reply("⏳ Chargement des matchs...");

  for (const match of matches.slice(0, 5)) {
    const imageUrl = `${API_BASE}/api/match-image/${match.id}?t=${Date.now()}`;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setImage(imageUrl)
      .setFooter({ text: `Match #${match.id} • ${match.competition} • Clique sur un bouton pour parier` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bet_home_${match.id}`)
        .setLabel(`🏠 ${match.homeTeam}  x${match.homeOdds.toFixed(2)}`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bet_draw_${match.id}`)
        .setLabel(`⚖️ Match Nul  x${match.drawOdds.toFixed(2)}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bet_away_${match.id}`)
        .setLabel(`✈️ ${match.awayTeam}  x${match.awayOdds.toFixed(2)}`)
        .setStyle(ButtonStyle.Danger),
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  }

  await sentMsg.delete().catch(() => {});
}
