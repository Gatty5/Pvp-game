import React, { useState, useCallback, useEffect, useRef } from 'react';
import World from './components/World';
import ChatInterface from './components/ChatInterface';
import PvpArena from './components/PvpArena';
import AuthScreen from './components/AuthScreen';
import { 
  Character, 
  Position, 
  GameMode, 
  ChatSession, 
  EntityType, 
  Message,
  PvpSession,
  Item,
  User
} from './types';
import { INITIAL_PLAYER, INITIAL_BOTS, SHOP_ITEMS } from './constants';
import { generateBotResponse, generateBotConversationTurn } from './services/geminiService';
import { cloudService } from './services/cloudService';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Character>(INITIAL_PLAYER);
  const [bots, setBots] = useState<Character[]>(INITIAL_BOTS);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.ROAMING);
  
  // Interaction Menu State
  const [selectedEntity, setSelectedEntity] = useState<Character | null>(null);

  // Active Sessions
  const [currentChatSession, setCurrentChatSession] = useState<ChatSession | null>(null);
  const [currentPvpSession, setCurrentPvpSession] = useState<PvpSession | null>(null);

  // Global UI State
  const [showGlobalShop, setShowGlobalShop] = useState(false);
  const [showGlobalSkills, setShowGlobalSkills] = useState(false);

  // --- Initial Session Check ---
  useEffect(() => {
    const session = cloudService.getCurrentSession();
    if (session) {
      setUser(session);
      setPlayer(session.characterData);
    }
  }, []);

  // --- Cloud Sync Effect ---
  useEffect(() => {
    if (user && player) {
      cloudService.syncCharacter(user.username, player);
    }
  }, [player, user]);

  // --- Bot Movement Logic (Simulated Multiplayer) ---
  useEffect(() => {
    if (!user) return;
    const moveInterval = setInterval(() => {
        setBots(prevBots => prevBots.map(bot => {
            if (bot.isMerchant || gameMode === GameMode.PVP) return bot;
            
            // Randomly decide to move
            if (Math.random() > 0.95) {
                const moveRange = 200;
                const newTarget = {
                    x: Math.max(100, Math.min(2900, bot.position.x + (Math.random() * moveRange - moveRange/2))),
                    y: Math.max(100, Math.min(2900, bot.position.y + (Math.random() * moveRange - moveRange/2)))
                };
                return { ...bot, targetPosition: newTarget };
            }

            // Interpolate position
            const dx = bot.targetPosition.x - bot.position.x;
            const dy = bot.targetPosition.y - bot.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 2) {
                const speed = 1.5;
                return {
                    ...bot,
                    position: {
                        x: bot.position.x + (dx/dist) * speed,
                        y: bot.position.y + (dy/dist) * speed
                    }
                };
            }
            return bot;
        }));
    }, 50);
    return () => clearInterval(moveInterval);
  }, [gameMode, user]);

  // Authentication Handler
  const handleAuthenticated = (loggedInUser: User) => {
    setUser(loggedInUser);
    setPlayer(loggedInUser.characterData);
  };

  const handleLogout = () => {
    cloudService.logout();
    setUser(null);
    setGameMode(GameMode.ROAMING);
  };

  // Movement Logic
  const handleMovePlayer = (targetPos: Position) => {
    setPlayer(prev => ({ ...prev, position: targetPos }));
  };

  const handleInteract = (entity: Character) => {
    if (entity.isMerchant) {
        setShowGlobalShop(true);
        return;
    }

    if (entity.type === EntityType.BOT) {
      // Check for bot-to-bot opportunity first
      const nearbyBot = bots.find(b => 
        b.id !== entity.id && 
        !b.isMerchant &&
        Math.sqrt(Math.pow(b.position.x - entity.position.x, 2) + Math.pow(b.position.y - entity.position.y, 2)) < 150
      );

      if (nearbyBot) {
         startBotObservation(entity, nearbyBot);
      } else {
         setSelectedEntity(entity);
         setGameMode(GameMode.MENU);
      }
    }
  };

  // --- MENU LOGIC ---
  const handleMenuSelect = (action: 'chat' | 'pvp') => {
    if (!selectedEntity) return;

    if (action === 'chat') {
        startPlayerChat(selectedEntity);
    } else if (action === 'pvp') {
        startPvp(selectedEntity);
    }
    setSelectedEntity(null);
  };

  // --- SHOP LOGIC (GLOBAL) ---
  const buyItemGlobal = (item: Item) => {
      if (!item.cost) return;
      if (player.gold >= item.cost) {
          setPlayer(prev => {
              const newGold = prev.gold - (item.cost || 0);
              let newInventory = [...prev.inventory];
              let newEquipment = { ...prev.equipment };

              if (item.type === 'WEAPON') {
                  newEquipment.weapon = item;
              } else if (item.type === 'SHIELD') {
                  newEquipment.shield = item;
              } else {
                  const idx = newInventory.findIndex(i => i.id === item.id);
                  if (idx >= 0) {
                      newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity + 1 };
                  } else {
                      newInventory.push({ ...item, quantity: 1 });
                  }
              }

              return { ...prev, gold: newGold, inventory: newInventory, equipment: newEquipment };
          });
      }
  };

  // --- CHAT LOGIC ---
  const startPlayerChat = (bot: Character) => {
    setGameMode(GameMode.CHATTING);
    setCurrentChatSession({
      participantIds: ['player', bot.id],
      messages: [],
      active: true,
    });
  };

  const startBotObservation = (bot1: Character, bot2: Character) => {
    setGameMode(GameMode.OBSERVING);
    setCurrentChatSession({
      participantIds: [bot1.id, bot2.id],
      messages: [],
      active: true,
    });
  };

  const handlePlayerMessage = async (text: string, useThinking: boolean) => {
    if (!currentChatSession) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: player.id,
      senderName: player.name,
      text: text,
      timestamp: Date.now(),
      isThinking: false,
    };

    const updatedMessages = [...currentChatSession.messages, newMessage];
    
    setCurrentChatSession({
      ...currentChatSession,
      messages: updatedMessages
    });

    const botId = currentChatSession.participantIds.find(id => id !== 'player');
    const bot = bots.find(b => b.id === botId);

    if (bot) {
      const response = await generateBotResponse({
        history: updatedMessages,
        userMessage: text,
        systemInstruction: `You are ${bot.name}. ${bot.personality}. You are chatting with a traveler.`,
        useThinking: useThinking
      });

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        senderId: bot.id,
        senderName: bot.name,
        text: response,
        timestamp: Date.now(),
        isThinking: useThinking
      };

      setCurrentChatSession(prev => prev ? ({
        ...prev,
        messages: [...prev.messages, botMessage]
      }) : null);
    }
  };

  const startBotConversationLoop = async () => {
      if (!currentChatSession || !currentChatSession.active) return;
      
      const bot1 = bots.find(b => b.id === currentChatSession.participantIds[0]);
      const bot2 = bots.find(b => b.id === currentChatSession.participantIds[1]);
      if (!bot1 || !bot2) return;

      const topic = "The legendary bosses lurking in the world edges.";
      let conversationHistory = [...currentChatSession.messages];

      for (let i = 0; i < 4; i++) {
          if (!currentChatSession.active) break;
          const currentSpeaker = i % 2 === 0 ? bot1 : bot2;
          const speakerKey = i % 2 === 0 ? 'bot1' : 'bot2';
          
          const text = await generateBotConversationTurn(
              speakerKey, 
              conversationHistory, 
              {
                  bot1Name: bot1.name, bot1Persona: bot1.personality,
                  bot2Name: bot2.name, bot2Persona: bot2.personality,
                  topic
              }
          );

          const msg: Message = {
              id: Date.now().toString() + i,
              senderId: currentSpeaker.id,
              senderName: currentSpeaker.name,
              text,
              timestamp: Date.now(),
              isThinking: true
          };

          conversationHistory.push(msg);
          setCurrentChatSession(prev => prev ? ({ ...prev, messages: conversationHistory }) : null);
          await new Promise(r => setTimeout(r, 2500));
      }
  };

  // --- PVP LOGIC ---
  const startPvp = (bot: Character) => {
      setGameMode(GameMode.PVP);
      setCurrentPvpSession({
          opponentId: bot.id,
          playerConfidence: 100,
          botConfidence: 100,
          range: 50,
          logs: [],
          active: true,
          isProcessing: false,
          winner: null
      });
  };

  const closeAll = (battleResult?: { newXp: number, newLevel: number, newGold: number, newInventory: Item[], newEquipment: any }) => {
    if (battleResult) {
        setPlayer(prev => ({
            ...prev,
            xp: battleResult.newXp,
            level: battleResult.newLevel,
            gold: battleResult.newGold,
            inventory: battleResult.newInventory,
            equipment: battleResult.newEquipment
        }));
    }
    setGameMode(GameMode.ROAMING);
    setCurrentChatSession(null);
    setCurrentPvpSession(null);
    setSelectedEntity(null);
  };

  const getChatParticipants = () => {
    if (!currentChatSession) return [];
    const parts: Character[] = [];
    currentChatSession.participantIds.forEach(id => {
      if (id === 'player') parts.push(player);
      else {
        const b = bots.find(bot => bot.id === id);
        if (b) parts.push(b);
      }
    });
    return parts;
  };

  const getPvpOpponent = () => {
      if (!currentPvpSession) return bots[0];
      return bots.find(b => b.id === currentPvpSession.opponentId) || bots[0];
  }

  // Auth Guard
  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="w-screen h-screen bg-gray-900 overflow-hidden text-white font-sans">
      <World 
        player={player} 
        bots={bots} 
        onMovePlayer={handleMovePlayer}
        onInteract={handleInteract}
        gameMode={gameMode}
        onOpenSkills={() => setShowGlobalSkills(true)}
      />

      {/* Logout Overlay */}
      <div className="fixed bottom-4 right-4 z-[90]">
        <button 
          onClick={handleLogout}
          className="bg-red-900/40 hover:bg-red-800/60 backdrop-blur-md px-4 py-2 rounded-xl border border-red-500/30 text-xs font-bold transition-all active:scale-95"
        >
          Logout Session
        </button>
      </div>

      {/* Interaction Menu */}
      {gameMode === GameMode.MENU && selectedEntity && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => closeAll()}>
              <div className="bg-gray-800 p-6 rounded-2xl shadow-xl flex flex-col gap-4 w-72 border border-gray-600 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                  <div className="text-center">
                      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-2 ${selectedEntity.color}`}>
                          {selectedEntity.emoji}
                      </div>
                      <h2 className="text-xl font-bold">{selectedEntity.name}</h2>
                      <div className="flex justify-center items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded border ${selectedEntity.isBoss ? 'bg-red-900 text-red-200 border-red-500' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'}`}>
                            Lvl {selectedEntity.level} {selectedEntity.isBoss && 'BOSS'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{selectedEntity.personality}</p>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                      <button onClick={() => handleMenuSelect('chat')} className="bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-semibold transition-colors">💬 Chat</button>
                      <button onClick={() => handleMenuSelect('pvp')} className="bg-red-600 hover:bg-red-500 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">⚔️ Duel</button>
                  </div>
              </div>
          </div>
      )}

      {/* GLOBAL SHOP MODAL */}
      {showGlobalShop && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setShowGlobalShop(false)}>
            <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-600 max-w-2xl w-full relative max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowGlobalShop(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-black text-white">General Shop</h2>
                    <p className="text-yellow-400 font-mono text-xl">Balance: 💰 {player.gold}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {SHOP_ITEMS.map((item, idx) => (
                        <button key={idx} onClick={() => buyItemGlobal(item)} className="bg-slate-700 border border-slate-500 p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-slate-600 active:scale-95 transition-all relative">
                            <div className="text-4xl">{item.emoji}</div>
                            <div className="text-sm font-bold text-white text-center">{item.name}</div>
                            <div className="text-[10px] text-gray-300 text-center">{item.description}</div>
                            <div className="mt-2 bg-black/30 px-3 py-1 rounded text-yellow-400 font-mono font-bold">{item.cost} G</div>
                            {player.gold < (item.cost || 0) && <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center text-red-500 font-black text-xs rotate-12">NOT ENOUGH GOLD</div>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* GLOBAL SKILLS MODAL (Placeholder for Tree reuse) */}
      {showGlobalSkills && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setShowGlobalSkills(false)}>
               <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-600 max-w-lg w-full text-center" onClick={e => e.stopPropagation()}>
                    <h2 className="text-3xl font-black text-purple-400 mb-4">Skill Library</h2>
                    <p className="text-gray-400 mb-8 italic">"Skills are managed in the heat of battle in the Arena. Duel an NPC to unlock and equip your powers."</p>
                    <div className="grid grid-cols-2 gap-4 text-left text-sm text-gray-300">
                        <div className="bg-slate-700/50 p-3 rounded-xl border border-white/5">🔥 Fireball: Lvl 1+</div>
                        <div className="bg-slate-700/50 p-3 rounded-xl border border-white/5">❄️ Frostbolt: Lvl 2+</div>
                        <div className="bg-slate-700/50 p-3 rounded-xl border border-white/5">⚡ Zap: Lvl 3+</div>
                        <div className="bg-slate-700/50 p-3 rounded-xl border border-white/5">💚 Mend: Lvl 5+</div>
                    </div>
                    <button onClick={() => setShowGlobalSkills(false)} className="mt-8 bg-purple-600 px-6 py-2 rounded-full font-bold">Close</button>
               </div>
          </div>
      )}

      {(gameMode === GameMode.CHATTING || gameMode === GameMode.OBSERVING) && currentChatSession && (
        <ChatInterface 
          session={currentChatSession}
          participants={getChatParticipants()}
          onSendMessage={handlePlayerMessage}
          onClose={() => closeAll()}
          isBotToBot={gameMode === GameMode.OBSERVING}
          onStartBotConversation={startBotConversationLoop}
        />
      )}

      {gameMode === GameMode.PVP && currentPvpSession && (
          <PvpArena 
            player={player}
            opponent={getPvpOpponent()}
            session={currentPvpSession}
            onExecuteTurn={() => {}}
            onClose={closeAll}
          />
      )}
    </div>
  );
}