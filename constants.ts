import { Character, EntityType, Item } from './types';

export const WORLD_SIZE = 3000;
export const VIEWPORT_WIDTH = window.innerWidth;
export const VIEWPORT_HEIGHT = window.innerHeight;

// --- ITEMS ---
export const POTION_HEAL: Item = {
  id: 'potion_heal',
  name: 'Health Potion',
  emoji: '🧪',
  type: 'CONSUMABLE',
  effect: 'HEAL',
  value: 40,
  quantity: 1,
  description: 'Restores 40 HP',
  cost: 50
};

export const BOMB_SMOKE: Item = {
  id: 'bomb_smoke',
  name: 'Smoke Bomb',
  emoji: '💨',
  type: 'CONSUMABLE',
  effect: 'BUFF',
  value: 0,
  quantity: 1,
  description: 'Increases dodge chance',
  cost: 40
};

export const THROWING_STAR: Item = {
  id: 'star',
  name: 'Throwing Star',
  emoji: '⭐',
  type: 'CONSUMABLE',
  effect: 'DAMAGE',
  value: 20,
  quantity: 1,
  description: 'Deals 20 DMG',
  cost: 60
};

// --- EQUIPMENT ---
export const WEAPON_RUSTY: Item = {
  id: 'w_rusty',
  name: 'Rusty Sword',
  emoji: '🗡️',
  type: 'WEAPON',
  effect: 'DAMAGE',
  value: 5,
  quantity: 1,
  description: '+5 ATK',
  cost: 100
};

export const WEAPON_IRON: Item = {
  id: 'w_iron',
  name: 'Iron Sword',
  emoji: '⚔️',
  type: 'WEAPON',
  effect: 'DAMAGE',
  value: 12,
  quantity: 1,
  description: '+12 ATK',
  cost: 300
};

export const WEAPON_GODSLAYER: Item = {
  id: 'w_god',
  name: 'Godslayer',
  emoji: '🔱',
  type: 'WEAPON',
  effect: 'DAMAGE',
  value: 50,
  quantity: 1,
  description: '+50 ATK (Very Heavy)',
  cost: 2500
};

export const SHIELD_WOOD: Item = {
  id: 's_wood',
  name: 'Wood Shield',
  emoji: '🛡️',
  type: 'SHIELD',
  effect: 'DEFENSE',
  value: 3,
  quantity: 1,
  description: '+3 DEF',
  cost: 80
};

export const SHIELD_IRON: Item = {
  id: 's_iron',
  name: 'Iron Shield',
  emoji: '🛡️',
  type: 'SHIELD',
  effect: 'DEFENSE',
  value: 8,
  quantity: 1,
  description: '+8 DEF',
  cost: 250
};

export const SHIELD_AEGIS: Item = {
  id: 's_aegis',
  name: 'Aegis Shield',
  emoji: '💠',
  type: 'SHIELD',
  effect: 'DEFENSE',
  value: 20,
  quantity: 1,
  description: '+20 DEF',
  cost: 1800
};

export const SHOP_ITEMS = [
  POTION_HEAL, THROWING_STAR, BOMB_SMOKE, 
  WEAPON_RUSTY, SHIELD_WOOD, 
  WEAPON_IRON, SHIELD_IRON,
  WEAPON_GODSLAYER, SHIELD_AEGIS
];

export const INITIAL_PLAYER: Character = {
  id: 'player',
  type: EntityType.PLAYER,
  name: 'Traveler',
  emoji: '🧙‍♂️',
  position: { x: 1500, y: 1500 },
  targetPosition: { x: 1500, y: 1500 },
  personality: 'Curious explorer',
  color: 'bg-blue-500',
  equippedItem: '🗡️',
  equipment: {
      weapon: undefined,
      shield: undefined
  },
  inventory: [{...POTION_HEAL, quantity: 3}, {...THROWING_STAR, quantity: 5}],
  level: 1,
  xp: 0,
  gold: 250
};

export const INITIAL_BOTS: Character[] = [
  // THE MERCHANT (STATIONARY)
  {
    id: 'bot_merchant',
    type: EntityType.BOT,
    name: 'Midas the Merchant',
    emoji: '🤑',
    position: { x: 1450, y: 1450 },
    targetPosition: { x: 1450, y: 1450 },
    personality: 'Greedy but fair. Loves gold more than anything.',
    color: 'bg-yellow-600',
    inventory: SHOP_ITEMS,
    level: 99,
    xp: 0,
    gold: 99999,
    isMerchant: true
  },
  // BOSSES
  {
    id: 'boss_1',
    type: EntityType.BOT,
    name: 'Goliath',
    emoji: '👹',
    position: { x: 2500, y: 500 },
    targetPosition: { x: 2500, y: 500 },
    personality: 'A hulking brute that crushes anything in its path.',
    color: 'bg-red-900',
    inventory: [],
    level: 25,
    xp: 5000,
    gold: 1000,
    isBoss: true
  },
  {
    id: 'boss_2',
    type: EntityType.BOT,
    name: 'The Lich',
    emoji: '💀',
    position: { x: 500, y: 2500 },
    targetPosition: { x: 500, y: 2500 },
    personality: 'Master of the undead. Speaks in raspy whispers.',
    color: 'bg-indigo-950',
    inventory: [],
    level: 30,
    xp: 8000,
    gold: 2000,
    isBoss: true
  },
  // SIMULATED PLAYERS
  ...Array.from({ length: 15 }).map((_, i) => ({
    id: `sim_player_${i}`,
    type: EntityType.BOT,
    name: `Player_${Math.floor(Math.random() * 900) + 100}`,
    emoji: ['🏃', '🤺', '🧙', '🏹', '👷'][Math.floor(Math.random() * 5)],
    position: { x: Math.random() * 2800 + 100, y: Math.random() * 2800 + 100 },
    targetPosition: { x: Math.random() * 2800 + 100, y: Math.random() * 2800 + 100 },
    personality: 'Just another player grinding for levels.',
    color: ['bg-pink-500', 'bg-cyan-500', 'bg-lime-500', 'bg-orange-500'][Math.floor(Math.random() * 4)],
    inventory: [],
    level: Math.floor(Math.random() * 15) + 1,
    xp: 0,
    gold: Math.floor(Math.random() * 500),
    isSimulatedPlayer: true
  })),
  // ORIGINAL BOTS
  {
    id: 'bot_1',
    type: EntityType.BOT,
    name: 'Sage Oak',
    emoji: '🌳',
    position: { x: 1600, y: 1400 },
    targetPosition: { x: 1600, y: 1400 },
    personality: 'Ancient, wise, speaks in metaphors.',
    color: 'bg-green-600',
    inventory: [POTION_HEAL],
    level: 10,
    xp: 500,
    gold: 100
  },
  {
    id: 'bot_2',
    type: EntityType.BOT,
    name: 'Rusty',
    emoji: '🤖',
    position: { x: 1400, y: 1600 },
    targetPosition: { x: 1400, y: 1600 },
    personality: 'Neurotic robot, obsessed with efficiency.',
    color: 'bg-gray-500',
    equippedItem: '🔧',
    inventory: [BOMB_SMOKE, THROWING_STAR],
    level: 2,
    xp: 100,
    gold: 50
  }
];

export const WORLD_ELEMENTS = [
  { x: 1500, y: 1450, emoji: '🏪' }, // Shop area
  { x: 950, y: 900, emoji: '🪨' },
  { x: 1150, y: 1100, emoji: '🌲' },
  { x: 2500, y: 550, emoji: '🏰' }, // Boss 1 area
  { x: 450, y: 2550, emoji: '🏚️' }, // Boss 2 area
  ...Array.from({ length: 40 }).map(() => ({
      x: Math.random() * 2800 + 100,
      y: Math.random() * 2800 + 100,
      emoji: ['🌲', '🌳', '🪨', '🌿', '🍄', '🌻'][Math.floor(Math.random() * 6)]
  }))
];