import { GoogleGenAI, Type } from "@google/genai";
import { Message } from '../types';

// Check for API Key
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY is missing from environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

// Helper to get a random standard model or specific thinking model
const getModel = (useThinking: boolean) => {
  if (useThinking) {
    return 'gemini-3-pro-preview';
  }
  return 'gemini-3-flash-preview';
};

interface ChatConfig {
  history: Message[];
  userMessage: string;
  systemInstruction: string;
  useThinking?: boolean;
}

export const generateBotResponse = async ({
  history,
  userMessage,
  systemInstruction,
  useThinking = false,
}: ChatConfig): Promise<string> => {
  try {
    const modelId = getModel(useThinking);
    
    // Transform our internal message format to Gemini's format if needed, 
    // but for simple single-turn generation or stateless chat, we can just construct a prompt.
    // However, keeping history is good. Let's use the chat API for consistency.
    
    // NOTE: For 'thinking' models, we must follow specific config rules.
    const config: any = {
      systemInstruction,
    };

    if (useThinking) {
      // CRITICAL: Set thinking budget for complex queries
      config.thinkingConfig = { thinkingBudget: 32768 }; 
      // Do NOT set maxOutputTokens when using thinking budget effectively without hard cap issues
    } 

    const chat = ai.chats.create({
      model: modelId,
      config,
    });

    // Only replay the last 5 messages to keep context relevant but not huge
    const relevantHistory = history.slice(-5);
    for (const msg of relevantHistory) {
        // We can't easily inject history into a fresh chat instance in this SDK version 
        // without manual turn management. 
    }

    // Construct a rich prompt that includes context if we aren't using session history features
    let fullPrompt = userMessage;
    if (relevantHistory.length > 0) {
      const contextStr = relevantHistory.map(m => `${m.senderName}: ${m.text}`).join('\n');
      fullPrompt = `Context of conversation so far:\n${contextStr}\n\nUser: ${userMessage}`;
    }

    const result = await chat.sendMessage({ message: fullPrompt });
    return result.text || "...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having a bit of a connection hiccup with the universe. Give me a moment.";
  }
};

interface BotToBotConfig {
  bot1Name: string;
  bot1Persona: string;
  bot2Name: string;
  bot2Persona: string;
  topic: string;
}

export const generateBotConversationTurn = async (
  currentSpeaker: 'bot1' | 'bot2',
  history: Message[],
  config: BotToBotConfig
): Promise<string> => {
    // We use the Thinking model here to generate high-quality banter
    const modelId = 'gemini-3-pro-preview';
    
    const speakerName = currentSpeaker === 'bot1' ? config.bot1Name : config.bot2Name;
    const otherName = currentSpeaker === 'bot1' ? config.bot2Name : config.bot1Name;
    const speakerPersona = currentSpeaker === 'bot1' ? config.bot1Persona : config.bot2Persona;

    const systemInstruction = `You are roleplaying as ${speakerName}. 
    Your personality: ${speakerPersona}.
    You are having a conversation with ${otherName}.
    The topic is: ${config.topic}.
    Keep your response concise (under 3 sentences) but full of character.
    Do not prefix your response with your name.`;

    const chatConfig: any = {
      systemInstruction,
      thinkingConfig: { thinkingBudget: 32768 } // Deep thinking for interesting banter
    };

    try {
        const chat = ai.chats.create({
            model: modelId,
            config: chatConfig,
        });

        const recentHistory = history.slice(-6).map(m => `${m.senderName}: ${m.text}`).join('\n');
        const prompt = `Here is the conversation so far:\n${recentHistory}\n\nIt is your turn to speak. Respond to ${otherName}.`;

        const result = await chat.sendMessage({ message: prompt });
        return result.text || "...";
    } catch (e) {
        console.error(e);
        return "...";
    }
}

interface PvpTurnResult {
  botRetort: string;
  playerDamage: number;
  botDamage: number;
  commentary: string;
  newRange: number;
}

export const executePvpTurn = async (
  playerMove: string,
  botName: string,
  botPersona: string,
  currentRange: number,
  history: string[]
): Promise<PvpTurnResult> => {
  try {
    // Use the pro model for complex evaluation and JSON output
    const modelId = 'gemini-3-pro-preview';

    const systemInstruction = `You are the Referee (Shoutcaster) for a real-time arena battle.
    
    Context:
    - Distance (Range): 0-100. (0=Touching, 100=Far).
    - Current Range: ${currentRange}.
    
    Mechanics:
    - SWORD attacks only hit if Range < 30.
    - ITEMS (Potions/Throwing) work at any range.
    - MOVE ADVANCE: Reduces Range by ~25.
    - MOVE RETREAT: Increases Range by ~25.
    - BLOCK: Reduces damage.
    
    Task:
    1. Parse Player Action ("${playerMove}").
    2. Decide Bot Action (Attack, Move, or Defend) based on Range and Persona.
    3. Resolve Outcomes.
    4. Provide "Commentary": Short, punchy, announcer style. Max 6 words. (e.g., "Critical Hit!", "Bot parries!", "Massive Damage!").
    
    Format output as JSON.`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Match History: ${history.slice(-3).join(' | ')}. Player Action: "${playerMove}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            botRetort: { type: Type.STRING, description: "Bot's internal thought/reaction (optional)" },
            playerDamage: { type: Type.NUMBER, description: "Damage dealt TO the player" },
            botDamage: { type: Type.NUMBER, description: "Damage dealt TO the bot" },
            newRange: { type: Type.NUMBER, description: "The updated distance (0-100)" },
            commentary: { type: Type.STRING, description: "Short announcer phrase (Max 6 words)" }
          },
          required: ["botRetort", "playerDamage", "botDamage", "newRange", "commentary"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as PvpTurnResult;
  } catch (error) {
    console.error("PVP Error:", error);
    return {
      botRetort: "...",
      playerDamage: 0,
      botDamage: 0,
      newRange: currentRange,
      commentary: "Connection Glitch!"
    };
  }
};

export const generateActionCommentary = async (
    events: string[],
    botName: string
): Promise<string> => {
    try {
        const modelId = 'gemini-3-flash-preview';
        const prompt = `You are an esports shoutcaster. 
        Recent events: ${events.join(', ')}.
        Match: Player vs ${botName}.
        
        Generate a single, hype, 5-word commentary phrase.`;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
        });
        return response.text?.trim() || "What a match!";
    } catch (e) {
        return "Unbelievable scenes!";
    }
}