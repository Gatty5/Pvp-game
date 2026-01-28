
import React, { useEffect, useRef, useState } from 'react';
import { Character, EntityType, Position, GameMode } from '../types';
import { WORLD_SIZE, WORLD_ELEMENTS } from '../constants';

interface WorldProps {
  player: Character;
  bots: Character[];
  onMovePlayer: (pos: Position) => void;
  onInteract: (entity: Character) => void;
  gameMode: GameMode;
  onOpenSkills: () => void;
}

const World: React.FC<WorldProps> = ({ player, bots, onMovePlayer, onInteract, gameMode, onOpenSkills }) => {
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  
  // Calculate stats for HUD
  const playerAtk = 8 + player.level + (player.equipment?.weapon?.value || 0);
  const playerDef = player.level + (player.equipment?.shield?.value || 0);
  const playerMaxHp = 100 + (player.level * 10);

  // Update viewport to center on player
  useEffect(() => {
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    
    let newX = player.position.x - halfWidth;
    let newY = player.position.y - halfHeight;

    // Clamp
    newX = Math.max(0, Math.min(newX, WORLD_SIZE - window.innerWidth));
    newY = Math.max(0, Math.min(newY, WORLD_SIZE - window.innerHeight));

    setViewport({ x: newX, y: newY });
  }, [player.position]);

  const handleWorldClick = (e: React.MouseEvent) => {
    if (gameMode !== GameMode.ROAMING) return;
    const clickX = e.clientX + viewport.x;
    const clickY = e.clientY + viewport.y;
    const clickedBot = bots.find(b => {
      const dist = Math.sqrt(Math.pow(b.position.x - clickX, 2) + Math.pow(b.position.y - clickY, 2));
      const size = b.isBoss ? 80 : 40;
      return dist < size;
    });
    if (clickedBot) onInteract(clickedBot);
    else onMovePlayer({ x: clickX, y: clickY });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a1018] cursor-crosshair select-none" onClick={handleWorldClick}>
      
      {/* --- HUD: TOP LEFT (STATS) --- */}
      <div className="absolute top-6 left-6 z-[50] flex flex-col gap-2 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-3xl border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.5)] ${player.color}`}>
                  {player.emoji}
              </div>
              <div>
                  <div className="flex items-center gap-2">
                      <span className="font-black text-lg tracking-tight">{player.name}</span>
                      <span className="bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Lvl {player.level}</span>
                  </div>
                  <div className="w-40 h-2 bg-gray-800 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-green-500 shadow-[0_0_8px_#22c55e]" style={{ width: '100%' }}></div>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] font-mono text-gray-400">
                      <span className="text-red-400">⚔️ ATK {playerAtk}</span>
                      <span className="text-blue-400">🛡️ DEF {playerDef}</span>
                      <span className="text-yellow-400">💰 {player.gold}G</span>
                  </div>
              </div>
          </div>
          {/* Simulated "Multiplayer" Feed */}
          <div className="bg-black/40 backdrop-blur-sm p-3 rounded-xl border border-white/5 w-48 hidden sm:block">
              <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Live Activity</div>
              <div className="flex flex-col gap-1">
                  <div className="text-[9px] animate-pulse">🟢 18 Players Online</div>
                  <div className="text-[9px] text-gray-400 flex justify-between"><span>Boss Goliath spawned</span><span className="text-red-500">!!!</span></div>
                  <div className="text-[9px] text-gray-400">Player_422 leveled up to 12</div>
              </div>
          </div>
      </div>

      {/* --- HUD: TOP RIGHT (MENU) --- */}
      <div className="absolute top-6 right-6 z-[50] flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); onOpenSkills(); }} className="bg-purple-600 hover:bg-purple-500 p-3 rounded-2xl border border-purple-400 shadow-lg pointer-events-auto transition-all active:scale-95">
              <span className="text-xl">⭐</span>
          </button>
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2 text-xs font-bold text-gray-300">
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> SERVER: NA-EAST #1
          </div>
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundPosition: `-${viewport.x}px -${viewport.y}px`, backgroundImage: `radial-gradient(circle, #ffffff 1.5px, transparent 1.5px)`, backgroundSize: '60px 60px' }} />

      {/* World Container */}
      <div className="absolute transition-transform duration-75 ease-linear" style={{ width: WORLD_SIZE, height: WORLD_SIZE, transform: `translate3d(${-viewport.x}px, ${-viewport.y}px, 0)` }}>
        
        {/* World Decoration */}
        {WORLD_ELEMENTS.map((el, i) => (
          <div key={i} className="absolute text-2xl select-none" style={{ left: el.x, top: el.y }}>
            {el.emoji}
          </div>
        ))}

        {/* Bots / Other Players */}
        {bots.map(bot => {
          const isBoss = bot.isBoss;
          const scale = isBoss ? 'scale-[2.5]' : 'scale-100';
          return (
            <div key={bot.id} className={`absolute flex flex-col items-center justify-center transition-all duration-[300ms] ease-linear`} style={{ left: bot.position.x, top: bot.position.y, transform: 'translate(-50%, -50%)' }}>
              
              {/* NPC Name & Level Tag */}
              <div className="absolute -top-12 flex flex-col items-center pointer-events-none w-max">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight shadow-md border ${bot.isBoss ? 'bg-red-600 text-white border-red-400' : bot.isSimulatedPlayer ? 'bg-white text-black border-gray-300' : 'bg-gray-800 text-white border-white/10'}`}>
                      {bot.name}
                      <span className="opacity-60">L{bot.level}</span>
                  </div>
                  {bot.isMerchant && <div className="bg-yellow-500 text-black px-1 rounded text-[8px] font-black mt-0.5">SHOP</div>}
              </div>

              {/* Bot Sprite */}
              <div className={`rounded-full shadow-2xl flex items-center justify-center border-2 border-white/20 relative transition-transform ${bot.color} ${scale} ${bot.isBoss ? 'w-20 h-20 text-5xl shadow-red-900/50' : 'w-12 h-12 text-2xl shadow-black/50'} ${bot.isMerchant ? 'animate-bounce' : 'animate-walk'}`}>
                {bot.emoji}
                {bot.isBoss && <div className="absolute -top-4 text-4xl animate-bounce">👑</div>}
                {bot.equippedItem && <span className="absolute -right-2 -bottom-1 text-base drop-shadow-md">{bot.equippedItem}</span>}
              </div>
            </div>
          );
        })}

        {/* Player */}
        <div className="absolute flex flex-col items-center justify-center transition-all duration-100 ease-out z-10" style={{ left: player.position.x, top: player.position.y, transform: 'translate(-50%, -50%)' }}>
          <div className="absolute -top-12 px-2 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-black uppercase border border-blue-300 shadow-md">YOU</div>
          <div className={`w-14 h-14 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] flex items-center justify-center text-3xl ${player.color} border-2 border-white relative`}>
            {player.emoji}
            {player.equipment?.weapon && <span className="absolute -right-3 -top-1 text-xl animate-wiggle">{player.equipment.weapon.emoji}</span>}
            {player.equipment?.shield && <span className="absolute -left-3 top-2 text-xl">{player.equipment.shield.emoji}</span>}
          </div>
        </div>
      </div>
      
      {/* Bottom Hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-bold uppercase tracking-widest bg-black/40 px-6 py-2 rounded-full backdrop-blur-md border border-white/5">
        Click world to roam • Meet players • Hunt Bosses
      </div>

      {/* Fix: Replaced jsx attribute with dangerouslySetInnerHTML to fix TypeScript error in non-Next.js environment */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes walk {
            0% { transform: translateY(0) rotate(-3deg); }
            50% { transform: translateY(-5px) rotate(3deg); }
            100% { transform: translateY(0) rotate(-3deg); }
        }
        .animate-walk { animation: walk 0.4s infinite ease-in-out; }
        
        @keyframes wiggle {
            0%, 100% { transform: rotate(0); }
            50% { transform: rotate(15deg); }
        }
        .animate-wiggle { animation: wiggle 1s infinite ease-in-out; }
      ` }} />
    </div>
  );
};

export default World;
