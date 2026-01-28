
import React, { useState, useEffect, useRef } from 'react';
import { Character, PvpSession, Item } from '../types';
import { generateActionCommentary } from '../services/geminiService';
import { SHOP_ITEMS } from '../constants';

interface PvpArenaProps {
  player: Character;
  opponent: Character;
  session: PvpSession;
  onExecuteTurn: (move: string) => void;
  onClose: (result?: { newXp: number, newLevel: number, newGold: number, newInventory: Item[], newEquipment: any }) => void;
}

interface FloatingText {
    id: number;
    text: string;
    x: number;
    y: number;
    color: string;
}

interface Projectile {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    owner: 'player' | 'bot';
    type: 'fireball' | 'frostbolt' | 'star';
    damage: number;
}

// --- SKILL DEFINITIONS ---
type SkillType = 'FIREBALL' | 'FROSTBOLT' | 'ZAP' | 'HEAL' | 'RAGE';

interface SkillDef {
    id: SkillType;
    name: string;
    emoji: string;
    cooldown: number;
    description: string;
    color: string;
    cost: number; // Skill points to unlock
}

const SKILL_TREE: SkillDef[] = [
    { id: 'FIREBALL', name: 'Fireball', emoji: '🔥', cooldown: 4000, description: 'Launch a fireball', color: 'bg-orange-600', cost: 0 },
    { id: 'FROSTBOLT', name: 'Frostbolt', emoji: '❄️', cooldown: 5000, description: 'Slows enemy', color: 'bg-cyan-600', cost: 1 },
    { id: 'ZAP', name: 'Zap', emoji: '⚡', cooldown: 2000, description: 'Instant hit', color: 'bg-yellow-600', cost: 1 },
    { id: 'HEAL', name: 'Mend', emoji: '💚', cooldown: 8000, description: 'Heal 25% HP', color: 'bg-green-600', cost: 2 },
    { id: 'RAGE', name: 'Rage', emoji: '💢', cooldown: 10000, description: '2x DMG for 5s', color: 'bg-red-700', cost: 3 },
];

// Game Constants
const PLAYER_SPEED = 4; 
const BOT_SPEED = 2.8; 
const ATTACK_RANGE = 70; 
const BASE_DAMAGE_PLAYER = 8;
const BASE_DAMAGE_BOT = 6;
const XP_PER_HIT = 10;
const XP_WIN_BONUS = 200;
const GOLD_WIN_BONUS = 50;

// Cooldowns (ms)
const PLAYER_ATTACK_COOLDOWN = 500;
const DASH_COOLDOWN = 1500;
const DASH_DURATION = 300;
const BLOCK_COOLDOWN = 2000;
const BLOCK_DURATION = 1000;
const ITEM_COOLDOWN = 1000;

const PvpArena: React.FC<PvpArenaProps> = ({ player, opponent, session, onExecuteTurn, onClose }) => {
  // --- Refs (Game Loop State) ---
  const arenaRef = useRef<HTMLDivElement>(null);
  const playerPos = useRef({ x: 150, y: 400 }); 
  const targetPos = useRef({ x: 150, y: 400 });
  const botPos = useRef({ x: 150, y: 100 });    
  const projectilesRef = useRef<Projectile[]>([]);
  
  // Inventory State
  const [playerItems, setPlayerItems] = useState<Item[]>(player.inventory.map(i => ({...i})));
  const botItemsRef = useRef<Item[]>(opponent.inventory.map(i => ({...i})));

  // Progression & Stats State
  const [xp, setXp] = useState(player.xp);
  const [level, setLevel] = useState(player.level);
  const [gold, setGold] = useState(player.gold);
  const [equipment, setEquipment] = useState<{weapon?: Item, shield?: Item}>(player.equipment || {});

  const [skillPoints, setSkillPoints] = useState(0); 
  const [unlockedSkills, setUnlockedSkills] = useState<Set<SkillType>>(new Set(['FIREBALL']));
  const [equippedSkills, setEquippedSkills] = useState<(SkillType | null)[]>(['FIREBALL', null]);
  
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [showShop, setShowShop] = useState(false);

  // Stats Calculations
  const maxPlayerHp = 100 + (level * 10);
  const playerAtk = BASE_DAMAGE_PLAYER + level + (equipment.weapon?.value || 0);
  const playerDef = level + (equipment.shield?.value || 0);

  const maxBotHp = 100 + (opponent.level * 20);
  const botAtk = BASE_DAMAGE_BOT + opponent.level;
  const botDef = Math.floor(opponent.level / 2);

  const [playerHp, setPlayerHp] = useState(maxPlayerHp);
  const [botHp, setBotHp] = useState(maxBotHp);

  // Status Effects
  const [playerRage, setPlayerRage] = useState(false);
  const botStatus = useRef({ isSlowed: false, slowTimer: 0 });

  // Action Timestamps
  const lastPlayerAttack = useRef(0);
  const lastSkill1 = useRef(0);
  const lastSkill2 = useRef(0);
  const lastPlayerItem = useRef(0);
  const lastBotAction = useRef(0);
  const lastDash = useRef(0);
  const lastBlock = useRef(0);
  
  const eventBuffer = useRef<string[]>([]);
  
  // UI State
  const [commentary, setCommentary] = useState("FIGHT!");
  const [gameActive, setGameActive] = useState(true);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  
  // Visual States
  const [playerAnim, setPlayerAnim] = useState<'idle' | 'run' | 'attack' | 'dash' | 'block' | 'cast'>('idle');
  const [botAnim, setBotAnim] = useState<'idle' | 'run' | 'attack' | 'dodge' | 'block'>('idle');
  const [moveMarker, setMoveMarker] = useState<{x: number, y: number} | null>(null);

  // --- XP Logic ---
  const gainXp = (amount: number) => {
      setXp(prev => {
          const nextXp = prev + amount;
          const nextLevelThreshold = level * 100; // Simple curve
          if (nextXp >= nextLevelThreshold) {
              setLevel(l => l + 1);
              setSkillPoints(sp => sp + 1);
              addFloatingText("LEVEL UP!", playerPos.current.x, playerPos.current.y - 60, "text-yellow-300 text-3xl font-black");
              setCommentary("LEVEL UP!");
              // Heal on level up
              setPlayerHp(maxPlayerHp + 10); 
              return nextXp - nextLevelThreshold;
          }
          return nextXp;
      });
  };

  const handleExit = () => {
      onClose({ 
          newXp: xp, 
          newLevel: level, 
          newGold: gold, 
          newInventory: playerItems, 
          newEquipment: equipment 
      });
  };

  // --- Game Loop ---
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
        if (!gameActive || showSkillTree || showShop) {
             if ((showSkillTree || showShop) && animationFrameId) {
                 animationFrameId = requestAnimationFrame(loop); // Keep updating for animations if needed, but pause physics logic
                 return;
             } else if (!gameActive) {
                return;
             }
        }

        const now = Date.now();

        // --- 1. Physics & Movement ---
        
        // Player
        let currentSpeed = PLAYER_SPEED;
        if (playerAnim === 'block' || playerAnim === 'cast') currentSpeed = 0;
        else if (playerAnim === 'dash') currentSpeed = PLAYER_SPEED * 3.5;

        if (currentSpeed > 0) {
            const dx = targetPos.current.x - playerPos.current.x;
            const dy = targetPos.current.y - playerPos.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > currentSpeed) {
                playerPos.current.x += (dx / dist) * currentSpeed;
                playerPos.current.y += (dy / dist) * currentSpeed;
                if (playerAnim === 'idle') setPlayerAnim('run');
            } else {
                playerPos.current.x = targetPos.current.x;
                playerPos.current.y = targetPos.current.y;
                if (playerAnim === 'run') setPlayerAnim('idle');
            }
        }

        // Bot Status Effects
        if (botStatus.current.isSlowed && now > botStatus.current.slowTimer) {
            botStatus.current.isSlowed = false;
        }

        // Bot AI Movement (Chase)
        const bx = playerPos.current.x - botPos.current.x;
        const by = playerPos.current.y - botPos.current.y;
        const bDist = Math.sqrt(bx * bx + by * by);

        if (botAnim !== 'block' && botAnim !== 'dodge') {
            let botSpeed = botAnim === 'attack' ? 0 : BOT_SPEED;
            if (botStatus.current.isSlowed) botSpeed *= 0.5;

            if (bDist > ATTACK_RANGE * 0.8) {
                 botPos.current.x += (bx / bDist) * botSpeed;
                 botPos.current.y += (by / bDist) * botSpeed;
                 if (botAnim === 'idle') setBotAnim('run');
            } else {
                 if (botAnim === 'run') setBotAnim('idle');
            }
        }

        // --- 2. Projectiles ---
        const remainingProjectiles: Projectile[] = [];
        projectilesRef.current.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Bounds check
            if (p.x < -50 || p.x > (arenaRef.current?.offsetWidth || 500) + 50 || p.y < -50 || p.y > (arenaRef.current?.offsetHeight || 800) + 50) {
                return; // Remove
            }

            // Hit Check
            const target = p.owner === 'player' ? botPos.current : playerPos.current;
            const dx = p.x - target.x;
            const dy = p.y - target.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 30) {
                // Impact!
                if (p.owner === 'player') {
                     handleBotTakeDamage(p.damage, p.type === 'fireball' ? 'fire' : 'frost');
                     if (p.type === 'frostbolt') {
                         botStatus.current.isSlowed = true;
                         botStatus.current.slowTimer = Date.now() + 3000;
                         addFloatingText("SLOWED", botPos.current.x, botPos.current.y - 50, "text-cyan-400 text-sm");
                     }
                } else {
                     handlePlayerTakeDamage(p.damage);
                }
                // Visual FX
                addFloatingText("💥", p.x, p.y, "text-2xl");
            } else {
                remainingProjectiles.push(p);
            }
        });
        projectilesRef.current = remainingProjectiles;


        // --- 3. Bot Brain (AI) ---
        handleBotAI(bDist);


        // --- 4. Boundary Checks ---
        const maxX = arenaRef.current?.offsetWidth || 300;
        const maxY = arenaRef.current?.offsetHeight || 500;
        playerPos.current.x = Math.max(20, Math.min(maxX - 20, playerPos.current.x));
        playerPos.current.y = Math.max(20, Math.min(maxY - 20, playerPos.current.y));
        botPos.current.x = Math.max(20, Math.min(maxX - 20, botPos.current.x));
        botPos.current.y = Math.max(20, Math.min(maxY - 20, botPos.current.y));

        animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameActive, playerAnim, botAnim, showSkillTree, showShop, level, maxPlayerHp, maxBotHp, playerAtk, playerDef]);

  // --- AI Sub-Systems ---

  const handleBotAI = (distToPlayer: number) => {
      const now = Date.now();
      if (botAnim !== 'idle' && botAnim !== 'run') return; // Busy

      // 1. REACTION (Dodge/Block incoming attacks)
      const isPlayerAttacking = playerAnim === 'attack' || playerAnim === 'cast';
      const incomingProjectile = projectilesRef.current.some(p => p.owner === 'player' && Math.abs(p.x - botPos.current.x) < 100 && Math.abs(p.y - botPos.current.y) < 100);

      if ((isPlayerAttacking && distToPlayer < 100) || incomingProjectile) {
          if (Math.random() < 0.03) { 
              if (Math.random() < 0.5) {
                  setBotAnim('dodge');
                  addFloatingText("DODGE!", botPos.current.x, botPos.current.y - 30, 'text-gray-400 italic text-xs');
                  setTimeout(() => setBotAnim('idle'), 400);
              } else {
                  setBotAnim('block');
                  setTimeout(() => setBotAnim('idle'), 800);
              }
              lastBotAction.current = now + 1000; 
              return;
          }
      }

      // 2. OFFENSE & ITEMS
      if (now - lastBotAction.current < 1000) return;

      const hpPercent = (botHp / maxBotHp) * 100;
      if (hpPercent < 40) {
          const potionIdx = botItemsRef.current.findIndex(i => i.effect === 'HEAL');
          if (potionIdx !== -1) {
              useBotItem(potionIdx);
              return;
          }
      }

      if (distToPlayer > 150) {
          const starIdx = botItemsRef.current.findIndex(i => i.name.includes('Star'));
          if (starIdx !== -1 && Math.random() < 0.05) {
              useBotItem(starIdx);
              return;
          }
      }

      if (distToPlayer < ATTACK_RANGE) {
          performBotAttack();
      }
  };

  const performBotAttack = () => {
      lastBotAction.current = Date.now();
      setBotAnim('attack');
      setTimeout(() => setBotAnim('idle'), 300);
      handlePlayerTakeDamage(botAtk);
      eventBuffer.current.push("Bot attacked");
  };

  const useBotItem = (index: number) => {
      const item = botItemsRef.current[index];
      if (!item || item.quantity <= 0) return;
      
      item.quantity--;
      if (item.quantity <= 0) botItemsRef.current.splice(index, 1);
      lastBotAction.current = Date.now() + 500;

      if (item.effect === 'HEAL') {
          setBotHp(h => Math.min(maxBotHp, h + item.value));
          addFloatingText("HEAL", botPos.current.x, botPos.current.y - 40, 'text-green-400 font-bold');
      } else if (item.name.includes('Star')) {
          spawnProjectile('star', 'bot', botPos.current, playerPos.current);
      }
  };

  const handleBotTakeDamage = (rawDamage: number, type: 'physical' | 'fire' | 'frost' | 'zap') => {
      if (botAnim === 'dodge') {
          addFloatingText("MISS", botPos.current.x, botPos.current.y - 30, 'text-gray-500');
          return;
      }
      
      // Defense Calculation
      // DMG = Raw - (Def/2)
      // Min DMG = 1
      const reducedDamage = Math.max(1, rawDamage - (botDef / 2));
      let finalDamage = Math.floor(reducedDamage);

      if (botAnim === 'block') {
          finalDamage = Math.ceil(finalDamage / 2);
          addFloatingText("BLOCKED", botPos.current.x, botPos.current.y - 20, 'text-blue-300 text-xs');
      }

      setBotHp(prev => {
          const newHp = Math.max(0, prev - finalDamage);
          
          let color = 'text-white';
          if (type === 'fire') color = 'text-orange-500 text-3xl font-black';
          else if (type === 'frost') color = 'text-cyan-400 text-xl font-bold';
          else if (type === 'zap') color = 'text-yellow-400 text-2xl font-bold italic';
          else color = 'text-red-500 text-2xl font-bold';

          addFloatingText(`-${finalDamage}`, botPos.current.x, botPos.current.y - 40, color);
          gainXp(XP_PER_HIT);

          if (newHp === 0) endGame('player');
          return newHp;
      });
  };

  const handlePlayerTakeDamage = (rawDamage: number) => {
      if (playerAnim === 'dash') {
          addFloatingText("DASHED!", playerPos.current.x, playerPos.current.y - 40, 'text-blue-400 italic');
          return;
      }

      // Defense Calculation
      const reducedDamage = Math.max(1, rawDamage - (playerDef / 2));
      let finalDamage = Math.floor(reducedDamage);

      if (playerAnim === 'block') {
          finalDamage = Math.ceil(finalDamage / 2);
          addFloatingText("BLOCKED", playerPos.current.x, playerPos.current.y - 20, 'text-blue-300 text-xs');
      }

      setPlayerHp(prev => {
          const newHp = Math.max(0, prev - finalDamage);
          addFloatingText(`-${finalDamage}`, playerPos.current.x, playerPos.current.y - 40, 'text-red-500 font-bold');
          if (newHp === 0) endGame('bot');
          return newHp;
      });
  };

  // --- Projectile System ---
  const spawnProjectile = (type: 'fireball' | 'frostbolt' | 'star', owner: 'player' | 'bot', start: {x: number, y: number}, target: {x: number, y: number}) => {
      const angle = Math.atan2(target.y - start.y, target.x - start.x);
      let speed = 9;
      let damage = 10;
      
      if (owner === 'bot') damage = botAtk;
      
      if (type === 'fireball') { 
          speed = 7; 
          damage = (owner === 'player' ? (playerAtk * 1.5) : 15); 
      }
      if (type === 'frostbolt') { 
          speed = 6; 
          damage = (owner === 'player' ? playerAtk : 10); 
      }
      if (type === 'star') {
          damage = (owner === 'player' ? (playerAtk * 0.8) : 10);
      }

      if (owner === 'player' && playerRage) damage *= 2;

      const startX = start.x + Math.cos(angle) * 30;
      const startY = start.y + Math.sin(angle) * 30;

      projectilesRef.current.push({
          id: Date.now() + Math.random(),
          x: startX,
          y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          owner,
          type,
          damage
      });
  };

  // --- Shop Logic ---
  const buyItem = (item: Item) => {
      if (!item.cost) return;
      if (gold >= item.cost) {
          setGold(g => g - (item.cost || 0));
          
          if (item.type === 'WEAPON') {
              setEquipment(prev => ({ ...prev, weapon: item }));
              addFloatingText("EQUIPPED!", playerPos.current.x, playerPos.current.y - 60, "text-yellow-400 font-bold");
          } else if (item.type === 'SHIELD') {
              setEquipment(prev => ({ ...prev, shield: item }));
              addFloatingText("EQUIPPED!", playerPos.current.x, playerPos.current.y - 60, "text-blue-400 font-bold");
          } else {
              // Add to inventory (stack if exists)
              setPlayerItems(prev => {
                  const existingIdx = prev.findIndex(i => i.id === item.id);
                  if (existingIdx >= 0) {
                      const newItems = [...prev];
                      newItems[existingIdx] = { ...newItems[existingIdx], quantity: newItems[existingIdx].quantity + 1 };
                      return newItems;
                  } else {
                      return [...prev, { ...item, quantity: 1 }];
                  }
              });
              addFloatingText("+1 ITEM", playerPos.current.x, playerPos.current.y - 60, "text-green-400");
          }
      } else {
          addFloatingText("NO GOLD", playerPos.current.x, playerPos.current.y - 60, "text-red-500 font-bold");
      }
  };

  // --- Commentary Interval ---
  useEffect(() => {
    const interval = setInterval(async () => {
        if (eventBuffer.current.length > 0 && gameActive) {
            const events = [...eventBuffer.current];
            eventBuffer.current = [];
            const text = await generateActionCommentary(events, opponent.name);
            setCommentary(text);
        }
    }, 4000);
    return () => clearInterval(interval);
  }, [opponent.name, gameActive]);

  // --- Player Actions ---

  const handlePlayerAttack = () => {
      if (!gameActive || (playerAnim !== 'idle' && playerAnim !== 'run')) return;
      if (Date.now() - lastPlayerAttack.current < PLAYER_ATTACK_COOLDOWN) return;

      lastPlayerAttack.current = Date.now();
      setPlayerAnim('attack');
      setTimeout(() => setPlayerAnim('idle'), 200);

      const dx = playerPos.current.x - botPos.current.x;
      const dy = playerPos.current.y - botPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ATTACK_RANGE) {
          const rageMult = playerRage ? 2 : 1;
          // Variation of +/- 20%
          const variance = (Math.random() * 0.4) + 0.8;
          const dmg = Math.floor(playerAtk * variance * rageMult);
          
          handleBotTakeDamage(dmg, 'physical');
          eventBuffer.current.push("Player landed hit");
      } else {
          addFloatingText("MISS", playerPos.current.x, playerPos.current.y - 40, 'text-gray-400 text-sm');
      }
  };

  const handleSkill = (slotIndex: number) => {
      if (!gameActive || (playerAnim !== 'idle' && playerAnim !== 'run')) return;
      
      const skillId = equippedSkills[slotIndex];
      if (!skillId) return;

      const skill = SKILL_TREE.find(s => s.id === skillId);
      if (!skill) return;

      const now = Date.now();
      const lastUsage = slotIndex === 0 ? lastSkill1 : lastSkill2;

      if (now - lastUsage.current < skill.cooldown) return;
      lastUsage.current = now;

      setPlayerAnim('cast');
      setTimeout(() => setPlayerAnim('idle'), 400);

      // Skill Logic
      if (skill.id === 'FIREBALL') {
          spawnProjectile('fireball', 'player', playerPos.current, botPos.current);
          addFloatingText("FIREBALL!", playerPos.current.x, playerPos.current.y - 50, 'text-orange-400 font-bold');
      } else if (skill.id === 'FROSTBOLT') {
          spawnProjectile('frostbolt', 'player', playerPos.current, botPos.current);
          addFloatingText("FREEZE!", playerPos.current.x, playerPos.current.y - 50, 'text-cyan-400 font-bold');
      } else if (skill.id === 'ZAP') {
          handleBotTakeDamage((playerRage ? 40 : 20) + (level * 2), 'zap');
          addFloatingText("ZAP!", botPos.current.x, botPos.current.y - 60, 'text-yellow-400 font-bold');
      } else if (skill.id === 'HEAL') {
          const healAmount = Math.floor(maxPlayerHp * 0.35);
          setPlayerHp(h => Math.min(maxPlayerHp, h + healAmount));
          addFloatingText(`+${healAmount} HP`, playerPos.current.x, playerPos.current.y - 50, 'text-green-500 font-black');
      } else if (skill.id === 'RAGE') {
          setPlayerRage(true);
          addFloatingText("RAGE!!!", playerPos.current.x, playerPos.current.y - 60, 'text-red-600 font-black text-2xl');
          setTimeout(() => setPlayerRage(false), 5000);
      }
      
      eventBuffer.current.push(`Player used ${skill.name}`);
  };

  const handleUseItem = (index: number) => {
      if (!gameActive) return;
      if (Date.now() - lastPlayerItem.current < ITEM_COOLDOWN) return;

      const items = [...playerItems];
      const item = items[index];
      if (!item || item.quantity <= 0) return;

      lastPlayerItem.current = Date.now();

      if (item.effect === 'HEAL') {
          setPlayerHp(h => Math.min(maxPlayerHp, h + item.value));
          addFloatingText(`+${item.value}`, playerPos.current.x, playerPos.current.y - 40, 'text-green-400 font-bold text-xl');
          addFloatingText("❤️", playerPos.current.x, playerPos.current.y - 60, 'text-2xl');
      } else if (item.name.includes('Star')) {
           setPlayerAnim('attack');
           setTimeout(() => setPlayerAnim('idle'), 200);
           spawnProjectile('star', 'player', playerPos.current, botPos.current);
      } else if (item.name.includes('Smoke')) {
           setPlayerAnim('dash');
           setTimeout(() => setPlayerAnim('idle'), 1500);
           addFloatingText("VANISH", playerPos.current.x, playerPos.current.y - 30, 'text-gray-300 tracking-widest');
      }

      item.quantity--;
      if (item.quantity <= 0) items.splice(index, 1);
      setPlayerItems(items);
  };

  const handleDash = () => {
      if (!gameActive) return;
      const now = Date.now();
      if (now - lastDash.current < DASH_COOLDOWN) return;
      if (playerAnim !== 'idle' && playerAnim !== 'run') return;

      lastDash.current = now;
      setPlayerAnim('dash');
      setTimeout(() => setPlayerAnim('idle'), DASH_DURATION);
      addFloatingText("DASH", playerPos.current.x, playerPos.current.y - 20, 'text-white text-xs tracking-widest');
  };

  const handleBlock = () => {
      if (!gameActive) return;
      const now = Date.now();
      if (now - lastBlock.current < BLOCK_COOLDOWN) return;
      if (playerAnim !== 'idle' && playerAnim !== 'run') return;

      lastBlock.current = now;
      setPlayerAnim('block');
      targetPos.current = { ...playerPos.current }; 
      setTimeout(() => setPlayerAnim('idle'), BLOCK_DURATION);
  };

  const endGame = (winner: 'player' | 'bot') => {
      setGameActive(false);
      if (winner === 'player') {
          setCommentary("K.O! YOU WIN!");
          gainXp(XP_WIN_BONUS);
          setGold(g => g + GOLD_WIN_BONUS);
      }
      else {
          setCommentary("DEFEATED...");
      }
      session.winner = winner; 
  };

  const handleArenaTap = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!gameActive || !arenaRef.current || playerAnim === 'block' || playerAnim === 'cast' || showSkillTree || showShop) return;
      
      const rect = arenaRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      targetPos.current = { x, y };
      setMoveMarker({ x, y });
      setTimeout(() => setMoveMarker(null), 500);
  };

  const addFloatingText = (text: string, x: number, y: number, color: string) => {
      const id = Date.now() + Math.random();
      setFloatingTexts(prev => [...prev, { id, text, x, y, color }]);
      setTimeout(() => {
          setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
      }, 1000);
  };

  const toggleSkill = (skillId: SkillType) => {
      if (unlockedSkills.has(skillId)) {
          // Equip logic
          setEquippedSkills(prev => {
              if (prev.includes(skillId)) return prev; // Already equipped
              // Simple logic: fill slot 1, then slot 2, then replace slot 1
              if (!prev[0]) return [skillId, prev[1]];
              if (!prev[1]) return [prev[0], skillId];
              return [skillId, prev[1]]; // Replace slot 1 by default
          });
      } else {
          // Unlock logic
          const skill = SKILL_TREE.find(s => s.id === skillId);
          if (skill && skillPoints >= skill.cost) {
              setSkillPoints(p => p - skill.cost);
              setUnlockedSkills(prev => new Set(prev).add(skillId));
              // Auto equip if empty slot
              setEquippedSkills(prev => {
                  if (!prev[0]) return [skillId, prev[1]];
                  if (!prev[1]) return [prev[0], skillId];
                  return prev;
              });
          }
      }
  };

  const getHealthColor = (hp: number, max: number) => {
    const pct = (hp / max) * 100;
    if (pct > 60) return 'bg-green-500';
    if (pct > 30) return 'bg-yellow-500';
    return 'bg-red-600';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 overflow-hidden">
        
        {/* --- TOP HUD --- */}
        <div className="h-28 bg-black/40 backdrop-blur-md flex justify-between items-start px-4 pt-2 border-b border-white/10 z-20 relative">
             <div className="flex flex-col w-1/3">
                 <div className="flex items-center gap-2 text-white font-bold text-sm mb-1">
                     <span>{player.emoji}</span> YOU
                     <span className="text-xs text-yellow-400 bg-black/50 px-2 rounded-full border border-yellow-600">Lvl {level}</span>
                 </div>
                 <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-1">
                     <div className={`h-full transition-all duration-200 ${getHealthColor(playerHp, maxPlayerHp)}`} style={{ width: `${(playerHp/maxPlayerHp)*100}%` }}></div>
                 </div>
                 {/* XP Bar */}
                 <div className="h-1 bg-gray-800 rounded-full overflow-hidden w-2/3 mb-2">
                     <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${Math.min(100, (xp / (level * 100)) * 100)}%` }}></div>
                 </div>
                 {/* Stats Mini Panel */}
                 <div className="flex gap-2 text-[10px] text-gray-300 font-mono">
                     <span className="text-red-300">ATK:{playerAtk}</span>
                     <span className="text-blue-300">DEF:{playerDef}</span>
                     <span className="text-yellow-300">💰{gold}</span>
                 </div>
             </div>

             <div className="flex-1 text-center px-2 flex flex-col items-center pt-2">
                 <span className="text-xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-red-500 drop-shadow-sm uppercase">
                     {commentary}
                 </span>
                 <div className="flex gap-2 mt-2">
                     <button 
                        onClick={() => setShowShop(true)}
                        className="bg-yellow-700 hover:bg-yellow-600 text-white text-xs px-3 py-1 rounded-lg border border-yellow-500 shadow-md transition-all"
                     >
                        🛒 SHOP
                     </button>
                     <button 
                        onClick={() => setShowSkillTree(true)}
                        className={`text-xs px-3 py-1 rounded-lg border shadow-md transition-all ${skillPoints > 0 ? 'bg-purple-600 hover:bg-purple-500 border-purple-300 animate-pulse' : 'bg-gray-700 hover:bg-gray-600 border-gray-500'}`}
                     >
                        ⭐ SKILLS {skillPoints > 0 && `(${skillPoints})`}
                     </button>
                 </div>
             </div>

             <div className="flex flex-col w-1/3 items-end">
                 <div className="flex items-center gap-2 text-white font-bold text-sm mb-1">
                     {opponent.name} <span>{opponent.emoji}</span>
                     <span className="text-xs text-red-400 bg-black/50 px-2 rounded-full border border-red-800">Lvl {opponent.level}</span>
                 </div>
                 <div className="h-3 bg-gray-700 rounded-full overflow-hidden w-full">
                     <div className={`h-full transition-all duration-200 float-right ${getHealthColor(botHp, maxBotHp)}`} style={{ width: `${(botHp/maxBotHp)*100}%` }}></div>
                 </div>
                 <div className="flex gap-1 mt-1 justify-end text-[10px] text-gray-400 font-mono">
                     <span>ATK:{botAtk}</span>
                     <span>DEF:{botDef}</span>
                 </div>
                 <div className="flex gap-1 mt-1">
                     {botStatus.current.isSlowed && <span className="text-[10px] bg-cyan-900 text-cyan-200 px-1 rounded border border-cyan-500">SLOW</span>}
                 </div>
             </div>
        </div>

        {/* --- ARENA --- */}
        <div 
            ref={arenaRef}
            className="flex-1 relative bg-[#1a1a2e] cursor-crosshair overflow-hidden"
            onMouseDown={handleArenaTap}
        >
            <div className="absolute inset-0 opacity-20" 
                style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
            />
            
            {moveMarker && (
                <div 
                    className="absolute w-4 h-4 border-2 border-white/50 rounded-full animate-ping pointer-events-none"
                    style={{ left: moveMarker.x - 8, top: moveMarker.y - 8 }}
                />
            )}

            {/* Projectiles */}
            {projectilesRef.current.map(p => (
                <div 
                    key={p.id}
                    className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-xl z-20 transition-transform duration-75`}
                    style={{ left: p.x - 12, top: p.y - 12, transform: `rotate(${Math.atan2(p.vy, p.vx)}rad)` }}
                >
                    {p.type === 'fireball' ? '🔥' : p.type === 'frostbolt' ? '❄️' : '⭐'}
                </div>
            ))}

            {/* Player */}
            <div 
                className={`absolute w-12 h-12 flex items-center justify-center transition-transform duration-75 pointer-events-none ${playerAnim === 'dash' ? 'opacity-50 blur-[1px]' : ''}`}
                style={{ 
                    left: 0, top: 0,
                    transform: `translate(${playerPos.current.x - 24}px, ${playerPos.current.y - 24}px) ${playerAnim === 'attack' || playerAnim === 'cast' ? 'scale(1.2)' : ''}`
                }}
            >
                <div className={`text-4xl filter drop-shadow-lg relative z-10 
                    ${playerAnim === 'attack' ? 'animate-wiggle' : ''} 
                    ${playerAnim === 'run' ? 'animate-walk' : ''}
                `}>
                    {player.emoji}
                </div>
                {/* Visual Gear */}
                {equipment.weapon && <div className="absolute -right-2 top-0 text-xl">{equipment.weapon.emoji}</div>}
                {equipment.shield && <div className="absolute -left-2 top-2 text-xl">{equipment.shield.emoji}</div>}

                {playerAnim === 'attack' && <div className="absolute -top-4 -right-4 text-4xl animate-swipe">{equipment.weapon ? equipment.weapon.emoji : '🗡️'}</div>}
                {playerAnim === 'block' && <div className="absolute inset-0 border-4 border-blue-400 rounded-full animate-pulse shadow-[0_0_15px_rgba(60,130,246,0.6)]"></div>}
                {playerAnim === 'cast' && <div className="absolute inset-0 border-4 border-orange-400 rounded-full animate-pulse"></div>}
                {playerRage && <div className="absolute -inset-2 border-2 border-red-500 rounded-full animate-spin-slow opacity-50"></div>}
            </div>

            {/* Bot */}
            <div 
                className={`absolute w-12 h-12 flex items-center justify-center transition-transform duration-75 pointer-events-none ${botAnim === 'dodge' ? 'opacity-50 blur-[1px]' : ''}`}
                style={{ 
                    left: 0, top: 0,
                    transform: `translate(${botPos.current.x - 24}px, ${botPos.current.y - 24}px) ${botAnim === 'attack' ? 'scale(1.2)' : ''}`
                }}
            >
                <div className={`text-4xl filter drop-shadow-lg scale-x-[-1] relative z-10 
                    ${botAnim === 'attack' ? 'animate-wiggle' : ''}
                    ${botAnim === 'run' ? 'animate-walk' : ''}
                `}>
                    {opponent.emoji}
                </div>
                {botAnim === 'block' && <div className="absolute inset-0 border-4 border-red-500 rounded-full animate-pulse"></div>}
                <div className="absolute w-full h-full rounded-full bg-red-500/10"></div>
                {botStatus.current.isSlowed && <div className="absolute inset-0 bg-cyan-400/30 rounded-full animate-pulse"></div>}
            </div>

            {/* Floating Text */}
            {floatingTexts.map(ft => (
                <div 
                    key={ft.id}
                    className={`absolute pointer-events-none animate-float-up font-bold z-50 ${ft.color}`}
                    style={{ left: ft.x, top: ft.y }}
                >
                    {ft.text}
                </div>
            ))}

            {/* SKILL TREE OVERLAY */}
            {showSkillTree && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-600 max-w-md w-full relative">
                        <button onClick={() => setShowSkillTree(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                        <h2 className="text-2xl font-bold text-white mb-2 text-center">Skill Tree</h2>
                        <div className="text-center text-yellow-400 mb-6 font-mono">Skill Points: {skillPoints}</div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {SKILL_TREE.map(skill => {
                                const unlocked = unlockedSkills.has(skill.id);
                                const equipped = equippedSkills.includes(skill.id);
                                const canUnlock = skillPoints >= skill.cost;

                                return (
                                    <button 
                                        key={skill.id}
                                        onClick={() => toggleSkill(skill.id)}
                                        disabled={!unlocked && !canUnlock}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all
                                            ${unlocked 
                                                ? (equipped ? 'border-green-500 bg-green-900/20' : 'border-slate-500 bg-slate-700') 
                                                : (canUnlock ? 'border-yellow-500 bg-yellow-900/20 hover:bg-yellow-900/40' : 'border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed')
                                            }
                                        `}
                                    >
                                        <span className="text-3xl mb-1">{skill.emoji}</span>
                                        <span className="text-[10px] font-bold text-white uppercase">{skill.name}</span>
                                        {!unlocked && <span className="text-[10px] text-yellow-500">{skill.cost} SP</span>}
                                        {equipped && <span className="text-[9px] bg-green-600 text-white px-1.5 rounded-full mt-1">EQUIPPED</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* SHOP OVERLAY */}
            {showShop && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-600 max-w-2xl w-full relative max-h-[80vh] overflow-y-auto">
                        <button onClick={() => setShowShop(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                        <h2 className="text-2xl font-bold text-white mb-2 text-center">Item Shop</h2>
                        <div className="text-center text-yellow-300 mb-6 font-mono font-bold text-xl">Your Gold: {gold}</div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {SHOP_ITEMS.map((item, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => buyItem(item)}
                                    className="bg-slate-700 border border-slate-500 p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-slate-600 active:scale-95 transition-all"
                                >
                                    <div className="text-4xl mb-1">{item.emoji}</div>
                                    <div className="text-sm font-bold text-white">{item.name}</div>
                                    <div className="text-xs text-gray-300">{item.description}</div>
                                    <div className="mt-2 bg-black/30 px-3 py-1 rounded text-yellow-400 font-mono font-bold">
                                        {item.cost} G
                                    </div>
                                    {gold < (item.cost || 0) && <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center text-red-500 font-black rotate-12 pointer-events-none">TOO POOR</div>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* --- CONTROLS --- */}
        <div className="bg-slate-900 pt-2 pb-6 px-4 border-t border-slate-700 relative z-30 flex flex-col gap-2">
             {gameActive ? (
                <>
                    {/* Items Bar */}
                    <div className="flex justify-center gap-3 mb-1">
                        {playerItems.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleUseItem(idx)}
                                className="bg-gray-800 border border-gray-600 rounded-lg p-1.5 flex items-center gap-2 hover:bg-gray-700 active:bg-gray-600 transition-colors"
                                title={item.description}
                            >
                                <span className="text-lg">{item.emoji}</span>
                                <span className="text-[10px] font-bold text-white">x{item.quantity}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-center items-center gap-3 sm:gap-6">
                        {/* SKILL SLOTS */}
                        {equippedSkills.map((sId, idx) => {
                            const skill = SKILL_TREE.find(s => s.id === sId);
                            const last = idx === 0 ? lastSkill1.current : lastSkill2.current;
                            
                            return (
                                <button
                                    key={idx}
                                    className={`w-14 h-14 rounded-xl border-b-4 shadow-lg flex flex-col items-center justify-center active:border-b-0 active:translate-y-1 transition-all group relative overflow-hidden
                                        ${skill ? skill.color : 'bg-gray-800 border-gray-900'}
                                    `}
                                    onClick={() => handleSkill(idx)}
                                    disabled={!skill}
                                >
                                    {skill ? (
                                        <>
                                            <div key={`sk-${idx}-${last}`} className="absolute inset-0 bg-black/50 origin-bottom animate-cooldown-skill pointer-events-none" style={{ animationDuration: `${skill.cooldown}ms` }}></div>
                                            <span className="text-2xl">{skill.emoji}</span>
                                            <span className="text-[9px] font-bold uppercase text-white/90">{skill.name}</span>
                                        </>
                                    ) : (
                                        <span className="text-gray-600 text-xs">Empty</span>
                                    )}
                                </button>
                            );
                        })}

                        {/* BLOCK */}
                        <button
                            className="w-14 h-14 bg-blue-700 rounded-xl border-b-4 border-blue-900 shadow-lg flex flex-col items-center justify-center active:border-b-0 active:translate-y-1 transition-all group relative overflow-hidden"
                            onClick={handleBlock}
                        >
                             <div key={`block-${lastBlock.current}`} className="absolute inset-0 bg-black/50 origin-bottom animate-cooldown-block pointer-events-none"></div>
                             <span className="text-2xl">🛡️</span>
                             <span className="text-[9px] font-bold uppercase text-blue-100">Block</span>
                        </button>

                        {/* ATTACK */}
                        <button
                            className="w-20 h-20 bg-red-600 rounded-full border-4 border-red-800 shadow-xl flex flex-col items-center justify-center active:scale-95 active:bg-red-700 transition-all group relative overflow-hidden mx-2"
                            onClick={handlePlayerAttack}
                        >
                            <div key={`atk-${lastPlayerAttack.current}`} className="absolute inset-0 bg-black/50 origin-bottom animate-cooldown-atk pointer-events-none"></div>
                            <span className="text-3xl z-10 group-active:rotate-12 transition-transform">
                                {equipment.weapon ? equipment.weapon.emoji : '🗡️'}
                            </span>
                            <span className="text-[9px] font-black uppercase text-red-100 z-10 tracking-widest mt-0.5">Atk</span>
                        </button>

                        {/* DASH */}
                        <button
                            className="w-14 h-14 bg-emerald-600 rounded-xl border-b-4 border-emerald-900 shadow-lg flex flex-col items-center justify-center active:border-b-0 active:translate-y-1 transition-all group relative overflow-hidden"
                            onClick={handleDash}
                        >
                             <div key={`dodge-${lastDash.current}`} className="absolute inset-0 bg-black/50 origin-bottom animate-cooldown-dodge pointer-events-none"></div>
                             <span className="text-2xl">💨</span>
                             <span className="text-[9px] font-bold uppercase text-emerald-100">Dash</span>
                        </button>
                    </div>
                </>
             ) : (
                <div className="flex justify-center">
                    <button 
                        onClick={handleExit}
                        className="bg-white text-black font-bold py-3 px-8 rounded-full shadow-lg hover:bg-gray-200 transition-colors"
                    >
                        Return to World
                    </button>
                </div>
             )}
        </div>

        {/* Fix: Replaced jsx attribute with dangerouslySetInnerHTML to fix TypeScript error in non-Next.js environment */}
        <style dangerouslySetInnerHTML={{ __html: `
            @keyframes wiggle {
                0%, 100% { transform: rotate(0deg); }
                25% { transform: rotate(-15deg); }
                75% { transform: rotate(15deg); }
            }
            .animate-wiggle { animation: wiggle 0.2s linear; }

            @keyframes walk {
                0% { transform: translateY(0) rotate(-5deg); }
                50% { transform: translateY(-3px) rotate(5deg); }
                100% { transform: translateY(0) rotate(-5deg); }
            }
            .animate-walk { animation: walk 0.3s infinite ease-in-out; }

            @keyframes swipe {
                0% { transform: rotate(0deg) translateX(0); opacity: 0; }
                20% { opacity: 1; }
                100% { transform: rotate(90deg) translateX(20px); opacity: 0; }
            }
            .animate-swipe { animation: swipe 0.2s ease-out; }

            @keyframes float-up {
                0% { transform: translateY(0); opacity: 1; }
                100% { transform: translateY(-40px); opacity: 0; }
            }
            .animate-float-up { animation: float-up 0.8s ease-out forwards; }

            @keyframes cooldown {
                0% { transform: scaleY(1); }
                100% { transform: scaleY(0); }
            }
            .animate-cooldown-atk { animation: cooldown 0.5s linear forwards; }
            .animate-cooldown-dodge { animation: cooldown 1.5s linear forwards; }
            .animate-cooldown-block { animation: cooldown 2.0s linear forwards; }
            .animate-cooldown-skill { animation: cooldown linear forwards; } /* Duration set inline */
        ` }} />
    </div>
  );
};

export default PvpArena;
