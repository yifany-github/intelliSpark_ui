import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  nsfwLevel: integer("nsfw_level").default(1),
  contextWindowLength: integer("context_window_length").default(10),
  temperature: integer("temperature").default(70),
  memoryEnabled: boolean("memory_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Scene Schema
export const scenes = pgTable("scenes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  location: text("location").notNull(),
  mood: text("mood").notNull(),
  rating: text("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSceneSchema = createInsertSchema(scenes).pick({
  name: true,
  description: true,
  imageUrl: true,
  location: true,
  mood: true,
  rating: true,
});

// Character Schema
export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  backstory: text("backstory").notNull(),
  voiceStyle: text("voice_style").notNull(),
  traits: json("traits").notNull().$type<string[]>(),
  personalityTraits: json("personality_traits").notNull().$type<Record<string, number>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCharacterSchema = createInsertSchema(characters).pick({
  name: true,
  avatarUrl: true,
  backstory: true,
  voiceStyle: true,
  traits: true,
  personalityTraits: true,
});

// Chat Schema
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sceneId: integer("scene_id").notNull().references(() => scenes.id),
  characterId: integer("character_id").notNull().references(() => characters.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChatSchema = createInsertSchema(chats).pick({
  userId: true,
  sceneId: true,
  characterId: true,
  title: true,
});

// Chat Message Schema
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  chatId: true,
  role: true,
  content: true,
});

// Types export
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Scene = typeof scenes.$inferSelect;
export type InsertScene = z.infer<typeof insertSceneSchema>;

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;

export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
