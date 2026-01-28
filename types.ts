export interface Position {
  x: number;
  y: number;
}

export enum EntityType {
  PLAYER = 'PLAYER',
  BOT = 'BOT',
}

export interface Item {
  id: string;
  name: string;
  emoji: string;
  type: 'CONSUMABLE' | 'WEAPON' | 'SHIELD' | 'SPECIAL';
  effect: 'HEAL' | 'DAMAGE' | 'BUFF' | 'NONE' | 'DEFENSE';
  value: number; 
  quantity: number;
  description: string;
  cost?: number; 
}

export interface User {
  username: string;
  password?: string; // Stored in the "cloud" (localStorage)
  characterData: Character;
  createdAt: number;
}

export interface Character {
  id: string;
  type: EntityType;
  name: string;
  emoji: string;
  position: Position;
  targetPosition: Position; 
  personality: string;
  color: string;
  equippedItem?: string; 
  equipment?: {
    weapon?: Item;
    shield?: Item;
  };
  inventory: Item[];
  maxHp?: number; 
  level: number;
  xp: number;
  gold: number;
  isBoss?: boolean;
  isMerchant?: boolean;
  isSimulatedPlayer?: boolean; // For "Multiplayer" feel
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isThinking?: boolean; 
}

export interface ChatSession {
  participantIds: string[]; 
  messages: Message[];
  active: boolean;
}

export interface PvpLog {
  turn: number;
  playerMove: string;
  botRetort: string;
  playerDamageTaken: number;
  botDamageTaken: number;
  commentary: string;
}

export interface PvpSession {
  opponentId: string;
  playerConfidence: number; 
  botConfidence: number; 
  range: number; 
  logs: PvpLog[];
  active: boolean;
  isProcessing: boolean;
  winner: 'player' | 'bot' | null;
}

export enum GameMode {
  ROAMING = 'ROAMING',
  CHATTING = 'CHATTING',
  OBSERVING = 'OBSERVING',
  PVP = 'PVP',
  MENU = 'MENU'
}