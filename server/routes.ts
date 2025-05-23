import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertChatMessageSchema, insertChatSchema } from "@shared/schema";
import { generateResponse } from "./services/openai";

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== SCENES ROUTES =====
  
  // Get all scenes
  app.get("/api/scenes", async (req, res) => {
    try {
      const scenes = await storage.getAllScenes();
      res.json(scenes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scenes" });
    }
  });
  
  // Get a single scene by ID
  app.get("/api/scenes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const scene = await storage.getScene(id);
      
      if (!scene) {
        return res.status(404).json({ message: "Scene not found" });
      }
      
      res.json(scene);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scene" });
    }
  });
  
  // ===== CHARACTERS ROUTES =====
  
  // Get all characters
  app.get("/api/characters", async (req, res) => {
    try {
      const characters = await storage.getAllCharacters();
      res.json(characters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });
  
  // Get a single character by ID
  app.get("/api/characters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const character = await storage.getCharacter(id);
      
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      
      res.json(character);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch character" });
    }
  });
  
  // ===== CHAT ROUTES =====
  
  // Get all chats
  app.get("/api/chats", async (req, res) => {
    try {
      const chats = await storage.getAllChats();
      res.json(chats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });
  
  // Get a single chat by ID
  app.get("/api/chats/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const chat = await storage.getChat(id);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat" });
    }
  });
  
  // Create a new chat
  app.post("/api/chats", async (req, res) => {
    try {
      const chatData = insertChatSchema.parse({
        ...req.body,
        userId: 1, // For now, hardcode userId to 1
      });
      
      const chat = await storage.createChat(chatData);
      
      // Create initial message from the AI
      const scene = await storage.getScene(chatData.sceneId);
      const character = await storage.getCharacter(chatData.characterId);
      
      if (scene && character) {
        const initialMessage = await storage.createChatMessage({
          chatId: chat.id,
          role: "assistant",
          content: `Welcome to ${scene.name}. I am ${character.name}. How can I assist you today?`,
        });
      }
      
      res.status(201).json(chat);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid chat data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create chat" });
    }
  });
  
  // Get all messages for a chat
  app.get("/api/chats/:id/messages", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const messages = await storage.getChatMessages(chatId);
      
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });
  
  // Add a message to a chat
  app.post("/api/chats/:id/messages", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const messageData = insertChatMessageSchema.parse({
        ...req.body,
        chatId,
      });
      
      const message = await storage.createChatMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create message" });
    }
  });
  
  // Generate AI response
  app.post("/api/chats/:id/generate", async (req, res) => {
    try {
      const chatId = parseInt(req.params.id);
      const chat = await storage.getChat(chatId);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      // Get recent messages, character, and scene
      const messages = await storage.getChatMessages(chatId);
      const character = await storage.getCharacter(chat.characterId);
      const scene = await storage.getScene(chat.sceneId);
      
      if (!character || !scene) {
        return res.status(404).json({ message: "Character or scene not found" });
      }
      
      // Generate response
      const response = await generateResponse(scene, character, messages);
      
      // Save the response
      const aiMessage = await storage.createChatMessage({
        chatId,
        role: "assistant",
        content: response,
      });
      
      res.json(aiMessage);
    } catch (error) {
      console.error("Error generating response:", error);
      res.status(500).json({ message: "Failed to generate AI response" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
