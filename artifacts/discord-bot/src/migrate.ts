import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🔄 Création des tables...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      discord_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0,
      total_tickets INTEGER NOT NULL DEFAULT 0,
      won_bets INTEGER NOT NULL DEFAULT 0,
      lost_bets INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT NOT NULL UNIQUE,
      referral_count INTEGER NOT NULL DEFAULT 0,
      used_referral_code BOOLEAN NOT NULL DEFAULT FALSE,
      voice_joined_at TIMESTAMP,
      is_streaming BOOLEAN NOT NULL DEFAULT FALSE,
      has_camera BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_team_emoji TEXT NOT NULL DEFAULT '🏠',
      away_team_emoji TEXT NOT NULL DEFAULT '✈️',
      competition TEXT NOT NULL DEFAULT 'Ligue 1',
      match_date TIMESTAMP NOT NULL,
      home_odds REAL NOT NULL,
      draw_odds REAL NOT NULL,
      away_odds REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      home_score INTEGER,
      away_score INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scorers (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id),
      player_name TEXT NOT NULL,
      team TEXT NOT NULL,
      odds REAL NOT NULL,
      scored BOOLEAN
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      match_id INTEGER NOT NULL REFERENCES matches(id),
      bet_type TEXT NOT NULL,
      bet_value TEXT NOT NULL,
      amount INTEGER NOT NULL,
      odds REAL NOT NULL,
      potential_win REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL UNIQUE,
      voice_coins_interval INTEGER NOT NULL DEFAULT 10,
      voice_coins_amount INTEGER NOT NULL DEFAULT 5,
      chat_coins_amount INTEGER NOT NULL DEFAULT 1,
      live_channel_id TEXT,
      live_message_id TEXT
    )
  `);

  console.log("✅ Tables créées avec succès !");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Erreur lors de la migration:", err);
  process.exit(1);
});
