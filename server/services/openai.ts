import { ChatMessage, Character, Scene } from "@shared/schema";
import OpenAI from "openai";

interface OpenAIMessage {
  role: string;
  content: string;
}



OPENAI_API_KEY=your_openai_api_key_here
// Initialize the OpenAI API client with a fallback for development
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Generate a response from the AI model based on the scene, character, and conversation history.
 */
export async function generateResponse(
  scene: Scene,
  character: Character,
  messages: ChatMessage[]
): Promise<string> {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not found. Using simulated responses.");
      return simulateAIResponse(character, scene, mapToOpenAIMessages(messages));
    }

    // Create system message with scene and character information
    const systemMessage = `You are in the ${scene.name}: ${scene.description}. The mood is ${scene.mood}.`;
    
    // Create assistant's persona message
    const personaMessage = `Your persona: ${character.name}. ${character.backstory} Your personality traits: ${
      Object.entries(character.personalityTraits)
        .map(([trait, value]) => `${trait}: ${value}%`)
        .join(', ')
    }. Speak with this voice style: ${character.voiceStyle}. Your character traits: ${
      character.traits.join(', ')
    }. Stay in character at all times.`;
    
    // Format conversation history
    const conversationHistory = messages
      .filter(msg => messages.indexOf(msg) >= Math.max(0, messages.length - 10)) // Last 10 messages
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
    
    // Prepare the messages for the API call
    const openaiMessages = [
      { role: "system", content: systemMessage },
      { role: "system", content: personaMessage },
      ...conversationHistory,
    ];
    
    // Call the OpenAI API
    if (!openai) {
      return simulateAIResponse(character, scene, conversationHistory);
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: openaiMessages as any,
      temperature: 0.7,
      max_tokens: 500,
    });
    
    return response.choices[0].message.content || "I'm not sure how to respond to that.";
  } catch (error) {
    console.error("Error generating response:", error);
    return "I'm having trouble responding right now. Please try again later.";
  }
}

/**
 * Helper function to map ChatMessage array to OpenAI message format
 */
function mapToOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
  return messages
    .filter(msg => messages.indexOf(msg) >= Math.max(0, messages.length - 10)) // Last 10 messages
    .map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
}

/**
 * Generate a response for data analysis queries.
 */
export async function generateDataAnalysis(prompt: string, data: any): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY || !openai) {
      return "OpenAI API key is required for data analysis.";
    }

    // Format the data as a string
    const dataString = JSON.stringify(data, null, 2);

    // Create a system message with instructions for data analysis
    const systemMessage = `You are a data analysis expert. Analyze the provided data and respond to the user's query. 
    Provide insights, patterns, and recommendations based on the data. Always include numerical evidence to support your findings.`;
    
    // Create messages for the API call
    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: `Here is the data I want you to analyze:\n\n${dataString}\n\nMy question is: ${prompt}` }
    ];
    
    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: messages as any,
      temperature: 0.2, // Lower temperature for more focused, analytical responses
      max_tokens: 1000,
    });
    
    return response.choices[0].message.content || "I couldn't analyze this data.";
  } catch (error) {
    console.error("Error analyzing data:", error);
    return "There was an error analyzing the data. Please try again later.";
  }
}

/**
 * Function to generate SQL queries from natural language.
 */
export async function generateSQLQuery(prompt: string, databaseSchema: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY || !openai) {
      return "OpenAI API key is required for SQL generation.";
    }

    // Create a system message with instructions for SQL generation
    const systemMessage = `You are an expert SQL query generator. Your task is to convert natural language questions into correct SQL queries.
    Use the provided database schema to generate accurate queries. Only return the SQL query without any explanations, comments or markdown formatting.`;
    
    // Create messages for the API call
    const messages = [
      { role: "system", content: systemMessage },
      { role: "user", content: `Database schema:\n${databaseSchema}\n\nGenerate a SQL query for this question: ${prompt}` }
    ];
    
    // Call the OpenAI API with JSON response format
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: messages as any,
      temperature: 0.1, // Very low temperature for more deterministic SQL generation
      response_format: { type: "json_object" },
      max_tokens: 500,
    });
    
    // Parse the JSON response to extract the SQL query
    try {
      const content = response.choices[0].message.content || '';
      const jsonResponse = JSON.parse(content);
      return jsonResponse.sql || "Could not generate SQL query.";
    } catch (e) {
      console.error("Error parsing JSON response:", e);
      return response.choices[0].message.content || "Could not generate SQL query.";
    }
  } catch (error) {
    console.error("Error generating SQL:", error);
    return "There was an error generating the SQL query. Please try again later.";
  }
}

/**
 * When no OpenAI API key is available, we use this function to simulate responses.
 */
function simulateAIResponse(
  character: Character, 
  scene: Scene, 
  conversationHistory: OpenAIMessage[]
): string {
  // Get the last user message
  const lastUserMessage = conversationHistory
    .filter(msg => msg.role === "user")
    .pop()?.content || "";
  
  // Simple response templates based on character
  const responseTemplates: Record<string, string[]> = {
    "Elara": [
      "*gazes at you with ancient eyes that have seen centuries pass*\n\nThe Shadow Wars... a dark chapter indeed. Three centuries ago, the kingdoms fought not with steel and arrows, but with forbidden magic and nightmare creatures summoned from the void. Many settlements were reduced to ash, and the land itself was scarred with corruption that persists to this day in certain blighted regions.",
      "Few records of that time survive, as the victors sought to erase the knowledge of the dark arts employed. But I remember... I was there, though I was but an apprentice then.",
      "What else would you like to know about our realm's troubled history?",
      "*adjusts her ornate amulet thoughtfully*\n\nYour curiosity is refreshing. Most who walk these halls seek only power or favor from the crown.",
    ],
    "Kravus": [
      "*pounds his fist on a nearby table*\n\nBattle! There is honor in facing your enemy directly, not hiding behind walls and politics like these soft courtiers!",
      "In my homeland, we settle disputes with steel, not whispers and poison. These nobles wouldn't last a day in the northern wilderness.",
      "*eyes you suspiciously*\n\nYou don't look like you've ever held a sword. Perhaps you should train with me sometime, if you want to survive in these dangerous times.",
      "Enough talk! Let us drink and speak of glorious conquests!",
    ],
    "Lyra": [
      "*leans against the wall, twirling a dagger casually*\n\nLooking for something valuable, are we? I might know where to find it... for the right price.",
      "Trust no one in this court, not even me. *winks playfully* Especially not me.",
      "*glances around cautiously before speaking in a hushed tone*\n\nI've heard whispers about a secret passage beneath the throne room. Would be quite useful for... overhearing things one shouldn't.",
      "You're not as naive as you look. That could be useful... or dangerous.",
    ],
    "XN-7": [
      "*blinks with artificial eyes that glow subtly*\n\nAnalyzing your query... My database contains 1,247 relevant data points on this subject. I will summarize the most pertinent information.",
      "Human interactions follow patterns that I continue to study. Your behavior is... intriguing. Not entirely conforming to predicted outcomes.",
      "*tilts head at precise 23.5 degree angle*\n\nI have observed that humor often defuses tension in social situations. Would you like me to tell you a joke?",
      "My sensors detect elevated stress levels in your vocal patterns. Is something troubling you? I am programmed to listen effectively.",
    ],
  };
  
  // Get responses for this character, or default to generic responses
  const characterResponses = responseTemplates[character.name] || [
    "I'm pleased to meet you in this ${scene.name}.",
    "What brings you here today?",
    "Is there something specific you'd like to discuss?",
    "This ${scene.mood} atmosphere is quite fitting, don't you think?"
  ];
  
  // Select a random response
  const randomIndex = Math.floor(Math.random() * characterResponses.length);
  
  return characterResponses[randomIndex]
    .replace("${scene.name}", scene.name)
    .replace("${scene.mood}", scene.mood);
}
