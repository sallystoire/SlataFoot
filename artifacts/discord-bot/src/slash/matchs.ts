import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { eq } from "drizzle-orm";
import { db, matchesTable } from "../db.js";
import { getApiBase } from "../utils/apiBase.js";

export async function sendMatchCard(
  channel: ChatInputCommandInteraction["channel"],
  match: typeof matchesTable.$inferSelect,
) {
  if (!channel || !channel.isTextBased()) return;

  const imageUrl = `${getApiBase()}/api/match-image/${match.id}?t=${Date.now()}`;

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

  await (channel as import("discord.js").TextChannel).send({ embeds: [embed], components: [row] });
}

export async function slashMatchs(i: ChatInputCommandInteraction) {
  const id = i.options.getInteger("id");

  await i.deferReply({ ephemeral: true });

  if (id) {
    const match = await db.query.matchesTable.findFirst({
      where: (m, { and, eq: deq }) => and(deq(m.id, id), deq(m.status, "upcoming")),
    });
    if (!match) return i.editReply(`❌ Match #${id} introuvable ou déjà terminé.`);
    await sendMatchCard(i.channel, match);
    await i.editReply(`✅ Card du match #${id} générée !`);
    return;
  }

  const matches = await db.query.matchesTable.findMany({
    where: eq(matchesTable.status, "upcoming"),
    orderBy: (m, { asc }) => [asc(m.matchDate)],
  });

  if (matches.length === 0) return i.editReply("❌ Aucun match disponible. Utilise `/addmatch` pour en créer un.");

  await i.editReply(`⏳ Génération de ${Math.min(matches.length, 5)} card(s)...`);

  for (const match of matches.slice(0, 5)) {
    await sendMatchCard(i.channel, match);
  }

  await i.editReply(`✅ ${Math.min(matches.length, 5)} card(s) générée(s) !`);
}
