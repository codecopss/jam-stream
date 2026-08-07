import React from 'react';
import { Radio, Sun, Moon, MessageSquare } from 'lucide-react';

export const Header = ({ roomId, setRoomId, isDarkMode, setIsDarkMode, showChat, setShowChat, unreadCount = 0, t }) => (
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
        aria-label="Room ID"
      />
      {/* Chat Toggle Icon Button in Header */}
      <button 
        onClick={() => setShowChat(!showChat)} 
        aria-label="Toggle Live Chat"
        className={`p-2.5 rounded-xl border shadow-sm relative transition-transform active:scale-95 ${
          showChat 
            ? 'bg-emerald-500 text-zinc-950 border-emerald-400' 
            : unreadCount > 0 
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/20 animate-pulse'
              : t.card
        }`}
        title="Toggle Chat (Press 'C')"
      >
        <MessageSquare className="w-4 h-4" />
        {unreadCount > 0 && !showChat && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[9px] font-bold text-zinc-950 shadow-md animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)} 
        aria-label="Toggle Dark Mode"
        className={`p-2.5 rounded-xl border shadow-sm ${t.card}`}
        title="Toggle Theme"
      >
        {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
      </button>
    </div>
  </div>
);