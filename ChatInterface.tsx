import React, { useEffect, useRef, useState } from 'react';
import { Character, ChatSession, Message } from '../types';

interface ChatInterfaceProps {
  session: ChatSession;
  participants: Character[];
  onSendMessage: (text: string, useThinking: boolean) => void;
  onClose: () => void;
  isBotToBot: boolean;
  onStartBotConversation?: () => void; // Trigger for starting the bot-to-bot loop
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  session, 
  participants, 
  onSendMessage, 
  onClose,
  isBotToBot,
  onStartBotConversation
}) => {
  const [inputText, setInputText] = useState('');
  const [useThinking, setUseThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText, useThinking);
    setInputText('');
  };

  // Identify participants
  const bot = participants.find(p => p.id !== 'player') || participants[0];
  const otherBot = participants.find(p => p.id !== 'player' && p.id !== bot.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px] border border-gray-700 animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center space-x-3">
             <div className="flex -space-x-2">
                {participants.map(p => (
                    <div key={p.id} className={`w-8 h-8 rounded-full flex items-center justify-center ${p.color} border border-gray-900 text-sm`}>
                        {p.emoji}
                    </div>
                ))}
             </div>
             <div>
                <h2 className="text-white font-bold text-lg">
                    {isBotToBot ? "Bot Observation" : `Chat with ${bot.name}`}
                </h2>
                <p className="text-xs text-gray-400">
                    {isBotToBot ? "Listening to AI conversation..." : bot.personality.slice(0, 40) + "..."}
                </p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#1a1a1a]" ref={scrollRef}>
          {session.messages.length === 0 && (
             <div className="text-center text-gray-500 mt-10">
                {isBotToBot ? (
                    <div className="flex flex-col items-center gap-2">
                        <p>Bots are ready to talk.</p>
                        <button 
                            onClick={onStartBotConversation}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-semibold transition-colors"
                        >
                            Start Debate
                        </button>
                    </div>
                ) : (
                    <p>Start the conversation...</p>
                )}
             </div>
          )}
          
          {session.messages.map((msg) => {
            const isUser = msg.senderId === 'player';
            const sender = participants.find(p => p.id === msg.senderId);
            
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                   {!isUser && sender && (
                       <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${sender.color}`}>
                           {sender.emoji}
                       </div>
                   )}
                   
                   <div className={`px-4 py-2 rounded-2xl ${
                     isUser 
                       ? 'bg-blue-600 text-white rounded-br-none' 
                       : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
                   }`}>
                     <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
                            {msg.senderName}
                        </span>
                        {msg.isThinking && (
                            <span className="flex items-center gap-1 bg-purple-900/50 px-1.5 py-0.5 rounded text-[9px] text-purple-300 border border-purple-500/30">
                                <svg className="animate-spin h-2 w-2" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Deep Thought
                            </span>
                        )}
                     </div>
                     <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Area (Only for Player Chat) */}
        {!isBotToBot && (
          <div className="p-4 bg-gray-800 border-t border-gray-700">
             <div className="mb-2 flex items-center">
                 <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer hover:text-white transition-colors select-none">
                     <input 
                        type="checkbox" 
                        checked={useThinking} 
                        onChange={e => setUseThinking(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                     />
                     <span className="flex items-center gap-1">
                        Use Deep Thought
                        <span className="bg-gray-700 px-1 rounded text-[9px] border border-gray-600">Gemini 3 Pro</span>
                     </span>
                 </label>
             </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Say something..."
                className="flex-1 bg-gray-900 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
              />
              <button 
                type="submit" 
                disabled={!inputText.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-semibold transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        )}
        
        {isBotToBot && (
            <div className="p-4 bg-gray-800 border-t border-gray-700 flex justify-between items-center text-xs text-gray-400">
                <span>Observing AI Debate...</span>
                <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live Generation
                </span>
            </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;