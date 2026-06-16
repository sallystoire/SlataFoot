import { REST, Routes, SlashCommandBuilder } from "discord.js";

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche toutes les commandes disponibles"),

  new SlashCommandBuilder()
    .setName("matchs")
    .setDescription("Affiche les matchs disponibles")
    .addIntegerOption((o) => o.setName("id").setDescription("ID d'un match spécifique").setRequired(false)),

  new SlashCommandBuilder()
    .setName("buteur")
    .setDescription("Affiche les côtes des buteurs")
    .addIntegerOption((o) => o.setName("match_id").setDescription("ID du match").setRequired(false)),

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Voir tes paris en cours"),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Voir ton profil ou celui d'un autre utilisateur")
    .addUserOption((o) => o.setName("user").setDescription("Utilisateur cible").setRequired(false)),

  new SlashCommandBuilder()
    .setName("parrainage")
    .setDescription("Voir ton code de parrainage et tes stats"),

  new SlashCommandBuilder()
    .setName("code")
    .setDescription("Utiliser un code de parrainage")
    .addStringOption((o) => o.setName("code").setDescription("Code de parrainage").setRequired(true)),

  new SlashCommandBuilder()
    .setName("live")
    .setDescription("Afficher le suivi en direct des paris dans ce salon"),

  new SlashCommandBuilder()
    .setName("top")
    .setDescription("Classement des meilleurs parieurs"),

  new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configurer le bot (Admin)")
    .setDefaultMemberPermissions("8")
    .addSubcommand((s) =>
      s.setName("view").setDescription("Voir les paramètres actuels")
    )
    .addSubcommand((s) =>
      s.setName("voiceinterval")
        .setDescription("Intervalle vocal (minutes)")
        .addIntegerOption((o) => o.setName("minutes").setDescription("Nombre de minutes").setRequired(true).setMinValue(1).setMaxValue(60))
    )
    .addSubcommand((s) =>
      s.setName("voicecoins")
        .setDescription("Coins gagnés par intervalle vocal")
        .addIntegerOption((o) => o.setName("montant").setDescription("Montant de coins").setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s.setName("chatcoins")
        .setDescription("Coins gagnés par message")
        .addIntegerOption((o) => o.setName("montant").setDescription("Montant de coins").setRequired(true).setMinValue(1))
    ),

  new SlashCommandBuilder()
    .setName("addmatch")
    .setDescription("Ajouter un match (Admin)")
    .setDefaultMemberPermissions("8")
    .addStringOption((o) => o.setName("equipe1").setDescription("Équipe domicile").setRequired(true))
    .addStringOption((o) => o.setName("equipe2").setDescription("Équipe extérieur").setRequired(true))
    .addNumberOption((o) => o.setName("cote1").setDescription("Côte équipe 1").setRequired(true).setMinValue(1.01))
    .addNumberOption((o) => o.setName("cotenul").setDescription("Côte match nul").setRequired(true).setMinValue(1.01))
    .addNumberOption((o) => o.setName("cote2").setDescription("Côte équipe 2").setRequired(true).setMinValue(1.01))
    .addStringOption((o) => o.setName("date").setDescription("Date du match (YYYY-MM-DDTHH:mm)").setRequired(true))
    .addStringOption((o) => o.setName("competition").setDescription("Nom de la compétition").setRequired(false))
    .addAttachmentOption((o) => o.setName("image").setDescription("Image de fond du match (photo du joueur/stade)").setRequired(false)),

  new SlashCommandBuilder()
    .setName("addbuteur")
    .setDescription("Ajouter un buteur à un match (Admin)")
    .setDefaultMemberPermissions("8")
    .addIntegerOption((o) => o.setName("match_id").setDescription("ID du match").setRequired(true))
    .addStringOption((o) => o.setName("joueur").setDescription("Nom du joueur").setRequired(true))
    .addStringOption((o) => o.setName("equipe").setDescription("Équipe du joueur").setRequired(true))
    .addNumberOption((o) => o.setName("cote").setDescription("Côte buteur").setRequired(true).setMinValue(1.01)),

  new SlashCommandBuilder()
    .setName("resultat")
    .setDescription("Définir le résultat d'un match (Admin)")
    .setDefaultMemberPermissions("8")
    .addIntegerOption((o) => o.setName("match_id").setDescription("ID du match").setRequired(true))
    .addStringOption((o) => o.setName("score").setDescription("Score ex: 2-1 ou 'nul'").setRequired(true)),

  new SlashCommandBuilder()
    .setName("editmatch")
    .setDescription("Modifier un match existant (Admin)")
    .setDefaultMemberPermissions("8")
    .addIntegerOption((o) => o.setName("match_id").setDescription("ID du match à modifier").setRequired(true))
    .addNumberOption((o) => o.setName("cote1").setDescription("Nouvelle côte domicile").setRequired(false).setMinValue(1.01))
    .addNumberOption((o) => o.setName("cotenul").setDescription("Nouvelle côte nul").setRequired(false).setMinValue(1.01))
    .addNumberOption((o) => o.setName("cote2").setDescription("Nouvelle côte extérieur").setRequired(false).setMinValue(1.01))
    .addStringOption((o) => o.setName("date").setDescription("Nouvelle date (YYYY-MM-DDTHH:mm)").setRequired(false))
    .addStringOption((o) => o.setName("competition").setDescription("Nom de la compétition").setRequired(false))
    .addAttachmentOption((o) => o.setName("image").setDescription("Nouvelle image de fond").setRequired(false)),

  new SlashCommandBuilder()
    .setName("coupon")
    .setDescription("Créer un coupon multi-matchs")
    .addStringOption((o) =>
      o.setName("matchs").setDescription("IDs des matchs séparés par des virgules (ex: 1,2,3)").setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

function getClientId(token: string): string {
  try {
    const firstPart = token.split(".")[0];
    return Buffer.from(firstPart, "base64url").toString("utf-8") ||
           Buffer.from(firstPart, "base64").toString("utf-8");
  } catch {
    throw new Error("Impossible d'extraire le client ID depuis le token");
  }
}

async function deployCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) { console.error("❌ DISCORD_BOT_TOKEN manquant"); process.exit(1); }
  const clientId = getClientId(token);

  const rest = new REST({ version: "10" }).setToken(token);

  console.log(`🔄 Enregistrement de ${commands.length} slash commands...`);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log("✅ Slash commands enregistrées globalement !");
  process.exit(0);
}

deployCommands().catch((e) => { console.error(e); process.exit(1); });
