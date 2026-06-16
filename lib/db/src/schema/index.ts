import { pgTable, text, integer, boolean, timestamp, real, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  coins: integer("coins").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  totalTickets: integer("total_tickets").notNull().default(0),
  wonBets: integer("won_bets").notNull().default(0),
  lostBets: integer("lost_bets").notNull().default(0),
  referralCode: text("referral_code").notNull().unique(),
  referralCount: integer("referral_count").notNull().default(0),
  usedReferralCode: boolean("used_referral_code").notNull().default(false),
  voiceJoinedAt: timestamp("voice_joined_at"),
  isStreaming: boolean("is_streaming").notNull().default(false),
  hasCamera: boolean("has_camera").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeTeamEmoji: text("home_team_emoji").notNull().default("🏠"),
  awayTeamEmoji: text("away_team_emoji").notNull().default("✈️"),
  competition: text("competition").notNull().default("Ligue 1"),
  matchDate: timestamp("match_date").notNull(),
  homeOdds: real("home_odds").notNull(),
  drawOdds: real("draw_odds").notNull(),
  awayOdds: real("away_odds").notNull(),
  status: text("status").notNull().default("upcoming"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  backgroundImageUrl: text("background_image_url"),
  backgroundImageData: text("background_image_data"),
  cardMessageId: text("card_message_id"),
  cardChannelId: text("card_channel_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scorersTable = pgTable("scorers", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id),
  playerName: text("player_name").notNull(),
  team: text("team").notNull(),
  odds: real("odds").notNull(),
  scored: boolean("scored"),
});

export const betsTable = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  matchId: integer("match_id").notNull().references(() => matchesTable.id),
  betType: text("bet_type").notNull(),
  betValue: text("bet_value").notNull(),
  amount: integer("amount").notNull(),
  odds: real("odds").notNull(),
  potentialWin: real("potential_win").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  matchIds: jsonb("match_ids").notNull().$type<number[]>(),
  betChoices: jsonb("bet_choices").notNull().$type<string[]>(),
  matchLabels: jsonb("match_labels").notNull().$type<string[]>(),
  combinedOdds: real("combined_odds").notNull(),
  amount: integer("amount").notNull(),
  potentialWin: real("potential_win").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  voiceCoinsInterval: integer("voice_coins_interval").notNull().default(10),
  voiceCoinsAmount: integer("voice_coins_amount").notNull().default(5),
  chatCoinsAmount: integer("chat_coins_amount").notNull().default(1),
  liveChannelId: text("live_channel_id"),
  liveMessageId: text("live_message_id"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true });
export const insertBetSchema = createInsertSchema(betsTable).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });

export type User = typeof usersTable.$inferSelect;
export type Match = typeof matchesTable.$inferSelect;
export type Scorer = typeof scorersTable.$inferSelect;
export type Bet = typeof betsTable.$inferSelect;
export type Coupon = typeof couponsTable.$inferSelect;
export type Settings = typeof settingsTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertBet = z.infer<typeof insertBetSchema>;
