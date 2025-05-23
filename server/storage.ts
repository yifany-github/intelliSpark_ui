import { 
  User, type InsertUser, 
  Scene, type InsertScene, 
  Character, type InsertCharacter, 
  Chat, type InsertChat,
  ChatMessage, type InsertChatMessage
} from "@shared/schema";

// Interface with CRUD methods for all entities
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Scene methods
  getScene(id: number): Promise<Scene | undefined>;
  getAllScenes(): Promise<Scene[]>;
  createScene(scene: InsertScene): Promise<Scene>;
  
  // Character methods
  getCharacter(id: number): Promise<Character | undefined>;
  getAllCharacters(): Promise<Character[]>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  
  // Chat methods
  getChat(id: number): Promise<Chat | undefined>;
  getAllChats(): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  
  // Chat message methods
  getChatMessages(chatId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private scenes: Map<number, Scene>;
  private characters: Map<number, Character>;
  private chats: Map<number, Chat>;
  private chatMessages: Map<number, ChatMessage>;
  
  private userId: number;
  private sceneId: number;
  private characterId: number;
  private chatId: number;
  private messageId: number;

  constructor() {
    this.users = new Map();
    this.scenes = new Map();
    this.characters = new Map();
    this.chats = new Map();
    this.chatMessages = new Map();
    
    this.userId = 1;
    this.sceneId = 1;
    this.characterId = 1;
    this.chatId = 1;
    this.messageId = 1;
    
    // Initialize with sample data
    this.initializeData();
  }

  // ===== USER METHODS =====
  
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id,
      nsfwLevel: 1,
      contextWindowLength: 10,
      temperature: 70,
      memoryEnabled: true,
      createdAt: now,
    };
    this.users.set(id, user);
    return user;
  }
  
  // ===== SCENE METHODS =====
  
  async getScene(id: number): Promise<Scene | undefined> {
    return this.scenes.get(id);
  }
  
  async getAllScenes(): Promise<Scene[]> {
    return Array.from(this.scenes.values());
  }
  
  async createScene(insertScene: InsertScene): Promise<Scene> {
    const id = this.sceneId++;
    const now = new Date();
    const scene: Scene = { ...insertScene, id, createdAt: now };
    this.scenes.set(id, scene);
    return scene;
  }
  
  // ===== CHARACTER METHODS =====
  
  async getCharacter(id: number): Promise<Character | undefined> {
    return this.characters.get(id);
  }
  
  async getAllCharacters(): Promise<Character[]> {
    return Array.from(this.characters.values());
  }
  
  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const id = this.characterId++;
    const now = new Date();
    const character: Character = { ...insertCharacter, id, createdAt: now };
    this.characters.set(id, character);
    return character;
  }
  
  // ===== CHAT METHODS =====
  
  async getChat(id: number): Promise<Chat | undefined> {
    return this.chats.get(id);
  }
  
  async getAllChats(): Promise<Chat[]> {
    return Array.from(this.chats.values());
  }
  
  async createChat(insertChat: InsertChat): Promise<Chat> {
    const id = this.chatId++;
    const now = new Date();
    const chat: Chat = { 
      ...insertChat, 
      id, 
      createdAt: now,
      updatedAt: now,
    };
    this.chats.set(id, chat);
    return chat;
  }
  
  // ===== CHAT MESSAGE METHODS =====
  
  async getChatMessages(chatId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.chatId === chatId)
      .sort((a, b) => a.id - b.id);
  }
  
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.messageId++;
    const now = new Date();
    const message: ChatMessage = { 
      ...insertMessage, 
      id, 
      timestamp: now,
    };
    this.chatMessages.set(id, message);
    
    // Update the chat's updatedAt timestamp
    const chat = this.chats.get(insertMessage.chatId);
    if (chat) {
      chat.updatedAt = now;
      this.chats.set(chat.id, chat);
    }
    
    return message;
  }
  
  // Initialize with sample data
  private initializeData() {
    // Create default user
    const user: User = {
      id: this.userId++,
      username: "user",
      password: "password",
      nsfwLevel: 1,
      contextWindowLength: 10,
      temperature: 70,
      memoryEnabled: true,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    
    // Create sample scenes
    const scenes: Partial<Scene>[] = [
      {
        name: "Royal Court",
        description: "Medieval castle intrigue",
        imageUrl: "https://via.placeholder.com/800x600.png?text=Royal+Court",
        location: "Castle",
        mood: "Intrigue",
        rating: "PG",
      },
      {
        name: "Star Voyager",
        description: "Deep space exploration",
        imageUrl: "https://via.placeholder.com/800x600.png?text=Star+Voyager",
        location: "Space",
        mood: "Adventure",
        rating: "PG-13",
      },
      {
        name: "Neo Tokyo",
        description: "Futuristic urban adventure",
        imageUrl: "https://via.placeholder.com/800x600.png?text=Neo+Tokyo",
        location: "City",
        mood: "Dark",
        rating: "M",
      },
      {
        name: "Tropical Getaway",
        description: "Paradise island resort",
        imageUrl: "https://via.placeholder.com/800x600.png?text=Tropical+Getaway",
        location: "Beach",
        mood: "Relaxed",
        rating: "PG",
      },
      {
        name: "Enchanted Woods",
        description: "Magical forest adventure",
        imageUrl: "https://via.placeholder.com/800x600.png?text=Enchanted+Woods",
        location: "Forest",
        mood: "Magical",
        rating: "G",
      },
      {
        name: "Wasteland",
        description: "Survival in the ruins",
        imageUrl: "https://via.placeholder.com/800x600.png?text=Wasteland",
        location: "Ruins",
        mood: "Gritty",
        rating: "M",
      },
    ];
    
    scenes.forEach(sceneData => {
      const scene: Scene = {
        id: this.sceneId++,
        name: sceneData.name!,
        description: sceneData.description!,
        imageUrl: sceneData.imageUrl!,
        location: sceneData.location!,
        mood: sceneData.mood!,
        rating: sceneData.rating!,
        createdAt: new Date(),
      };
      this.scenes.set(scene.id, scene);
    });
    
    // Create sample characters
    const characters: Partial<Character>[] = [
      {
        name: "Elara",
        avatarUrl: "https://via.placeholder.com/150x150.png?text=Elara",
        backstory: "Elara is the last of an ancient line of arcane practitioners who once advised kings and queens throughout the realm. After centuries of extending her life through magical means, she has accumulated vast knowledge but has grown somewhat detached from humanity.",
        voiceStyle: "Mystical, refined feminine voice",
        traits: ["Mage", "Wise", "Ancient", "Mysterious"],
        personalityTraits: { 
          Warmth: 40, 
          Humor: 20, 
          Intelligence: 95, 
          Patience: 75 
        },
      },
      {
        name: "Kravus",
        avatarUrl: "https://via.placeholder.com/150x150.png?text=Kravus",
        backstory: "A battle-hardened warrior from the northern plains, Kravus fights for honor and glory. His imposing presence and scarred visage tell of countless battles survived through sheer strength and determination.",
        voiceStyle: "Deep, commanding masculine voice",
        traits: ["Warrior", "Brash", "Honorable", "Strong"],
        personalityTraits: { 
          Warmth: 30, 
          Humor: 45, 
          Intelligence: 65, 
          Patience: 25 
        },
      },
      {
        name: "Lyra",
        avatarUrl: "https://via.placeholder.com/150x150.png?text=Lyra",
        backstory: "A nimble rogue with a mysterious past, Lyra uses her wit and cunning to survive in a world that has never shown her kindness. Despite her tough exterior, she harbors a soft spot for those who have been wronged.",
        voiceStyle: "Sly, confident feminine voice",
        traits: ["Rogue", "Tsundere", "Quick-witted", "Secretive"],
        personalityTraits: { 
          Warmth: 50, 
          Humor: 75, 
          Intelligence: 85, 
          Patience: 40 
        },
      },
      {
        name: "XN-7",
        avatarUrl: "https://via.placeholder.com/150x150.png?text=XN-7",
        backstory: "An advanced android with a curiosity about human emotions. XN-7 was designed to assist with complex calculations and data analysis, but has developed beyond its original programming and now seeks to understand what it means to be alive.",
        voiceStyle: "Synthetic, precise voice with subtle emotional undertones",
        traits: ["Android", "Logical", "Curious", "Evolving"],
        personalityTraits: { 
          Warmth: 25, 
          Humor: 10, 
          Intelligence: 99, 
          Patience: 90 
        },
      },
    ];
    
    characters.forEach(characterData => {
      const character: Character = {
        id: this.characterId++,
        name: characterData.name!,
        avatarUrl: characterData.avatarUrl!,
        backstory: characterData.backstory!,
        voiceStyle: characterData.voiceStyle!,
        traits: characterData.traits!,
        personalityTraits: characterData.personalityTraits!,
        createdAt: new Date(),
      };
      this.characters.set(character.id, character);
    });
    
    // Create a sample chat
    const chat: Chat = {
      id: this.chatId++,
      userId: user.id,
      sceneId: 1, // Royal Court
      characterId: 1, // Elara
      title: "Elara in Royal Court",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chats.set(chat.id, chat);
    
    // Create sample messages
    const messages: Partial<ChatMessage>[] = [
      {
        chatId: chat.id,
        role: "assistant",
        content: "Greetings, traveler. You stand within the hallowed halls of the Royal Court, where intrigue flows as freely as the wine. I am Elara, keeper of ancient wisdom and advisor to the throne. What brings you to this realm of politics and power?",
        timestamp: new Date(Date.now() - 5000),
      },
      {
        chatId: chat.id,
        role: "user",
        content: "I've come seeking knowledge about the kingdom's history. I heard you're the wisest person in the realm.",
        timestamp: new Date(Date.now() - 4000),
      },
      {
        chatId: chat.id,
        role: "assistant",
        content: "*adjusts her shimmering robes with a hint of a smile*\n\nWisdom comes with a price, as does all worthy knowledge. I have walked these halls for centuries, watching kings rise and fall like autumn leaves. What specific histories do you seek? The glory of the Crimson Dynasty? The Shadow Wars? Or perhaps... *her voice lowers* the forbidden tales of the royal bloodline's true origins?",
        timestamp: new Date(Date.now() - 3000),
      },
      {
        chatId: chat.id,
        role: "user",
        content: "Tell me about the Shadow Wars. I've only heard whispers of that conflict.",
        timestamp: new Date(Date.now() - 2000),
      },
    ];
    
    messages.forEach(messageData => {
      const message: ChatMessage = {
        id: this.messageId++,
        chatId: messageData.chatId!,
        role: messageData.role!,
        content: messageData.content!,
        timestamp: messageData.timestamp!,
      };
      this.chatMessages.set(message.id, message);
    });
  }
}

export const storage = new MemStorage();
