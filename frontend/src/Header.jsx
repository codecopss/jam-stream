import React from 'react';
import { Radio, Sun, Moon, MessageSquare } from 'lucide-react';

export const Header = ({ roomId, setRoomId, isDarkMode, setIsDarkMode, showChat, setShowChat, t }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-2">
      <Radio className="w-6 h-6 text-emerald-500" />
      <h2 className="text-xl font-bold uppercase tracking-wider">Jamstream</h2>
    </div>
    <div className="flex items-center gap-2">
      <input 
        className={`px-4 py-2 rounded-xl border font-mono text-sm shadow-inner focus:outline-none focus:ring-2 ${t.input}`} 
        value={roomId} 
        onChange={(e) => setRoomId(e.target.value.trim().toLowerCase())} 
        placeholder="Room ID" 
      />
      {/* Chat Toggle Icon Button in Header */}
      <button 
        onClick={() => setShowChat(!showChat)} 
        className={`p-2.5 rounded-xl border shadow-sm relative transition-transform active:scale-95 ${showChat ? 'bg-emerald-500 text-zinc-950 border-emerald-400' : t.card}`}
        title="Toggle Chat"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
      <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2.5 rounded-xl border shadow-sm ${t.card}`}>
        {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
      </button>
    </div>
  </div>
);