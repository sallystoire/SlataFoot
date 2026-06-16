import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";

export async function slashHelp(i: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("📖 Aide — BetBot")
    .setColor(0x5865f2)
    .setDescription("Bienvenue sur **BetBot** ! Toutes les commandes sont en slash `/`.")
    .addFields(
      { name: "⚽ Paris Sportifs", value: [
        "`/matchs` — Voir tous les matchs (avec cards + boutons)",
        "`/matchs id:2` — Voir un match spécifique",
        "`/buteur` — Côtes des buteurs",
        "`/ticket` — Tes paris en cours",
      ].join("\n") },
      { name: "👤 Profil & Économie", value: [
        "`/profile` — Ton profil (coins, XP, stats)",
        "`/parrainage` — Ton code unique de parrainage",
        "`/code <code>` — Utiliser un code parrain (+200 🪙)",
        "`/top` — Classement des meilleurs parieurs",
      ].join("\n") },
      { name: "📡 Live", value: "`/live` — Activer le suivi en direct des paris" },
      { name: "⚙️ Admin", value: [
        "`/addmatch` — Ajouter un match (avec image de fond optionnelle)",
        "`/addbuteur` — Ajouter un buteur à un match",
        "`/resultat` — Définir le score et distribuer les gains",
        "`/settings` — Configurer le bot",
      ].join("\n") },
      { name: "💡 Gagner des coins", value: [
        "🎙️ **Vocal** → coins toutes les X minutes",
        "📹 **Stream** → x1.5 coins",
        "📸 **Cam + Stream** → x2 coins",
        "💬 **Message** → +1 🪙 par message",
      ].join("\n") },
    )
    .setFooter({ text: "BetBot • Slash Commands /" })
    .setTimestamp();

  await i.reply({ embeds: [embed], ephemeral: true });
}
