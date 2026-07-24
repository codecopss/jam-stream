import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, ListMusic, X, Radio, Send, MessageSquare, UserCheck, Play } from 'lucide-react';
import { useJamSocket } from './useJamSocket';
import { Header } from './Header';
import { PlayerControls } from './PlayerControls';

export default function CompleteJamMusicApp() {
  const jam = useJamSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [userName, setUserName] = useState(`User_${Math.floor(1000 + Math.random() * 9000)}`);
  const chatEndRef = useRef(null);

  const chatMessages = jam.state?.chatHistory || [];

  useEffect(() => {
    if (showChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, showChat]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = newMessageText.trim();
    if (!text || !jam.socket) return;

    jam.socket.emit('sendMessage', {
      roomId: jam.roomId,
      sender: userName.trim() || 'Anonymous',
      text: text
    });

    setNewMessageText('');
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    jam.setSearchResults([]);
  };

  const t = isDarkMode ? {
    bg: 'bg-zinc-950 text-zinc-100', card: 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900/90',
    input: 'bg-zinc-900/90 text-zinc-100 border-zinc-800 focus:ring-zinc-800',
    muted: 'text-zinc-400', panel: 'bg-zinc-950/95 border-zinc-800', btn: 'bg-zinc-800 border-zinc-700 text-zinc-100'
  } : {
    bg: 'bg-stone-100 text-stone-800', card: 'bg-white border-stone-200 shadow-sm hover:bg-stone-50',
    input: 'bg-white text-stone-800 border-stone-300 focus:ring-stone-200',
    muted: 'text-stone-500', panel: 'bg-stone-100/95 border-stone-300', btn: 'bg-stone-200 border-stone-300 text-stone-800'
  };

  return (
    <div className={`flex flex-col h-screen ${t.bg} font-sans overflow-hidden p-4 md:p-8 relative`}>
      <div id="hidden-youtube-player" className="fixed bottom-0 right-0 w-[1px] h-[1px] opacity-10 pointer-events-none z-[-1]" />

      {/* Queue Alert Popup */}
      {jam.popupMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500 text-zinc-950 font-bold text-xs md:text-sm px-4 py-3 rounded-xl shadow-xl transition-all animate-bounce">
          {jam.popupMessage}
        </div>
      )}

      {/* Unlock Audio Overlay */}
      {!jam.isAudioUnlocked && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm text-center shadow-2xl">
            <Radio className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Tap to Join Room</h3>
            <button onClick={jam.unlockAudio} className="w-full py-3 bg-emerald-500 text-zinc-950 font-bold text-sm rounded-xl">
              Enable Audio & Sync
            </button>
          </div>
        </div>
      )}

      <Header roomId={jam.roomId} setRoomId={jam.setRoomId} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} showChat={showChat} setShowChat={setShowChat} t={t} />

      <div className="flex flex-1 gap-6 overflow-hidden mb-28 relative">
        <div className="flex-1 overflow-y-auto space-y-4">
          
          {/* Search Input Bar with Clear Action */}
          <div className="flex gap-2 relative items-center">
            <Search className={`w-4 h-4 absolute left-4 ${t.muted}`} />
            <input 
              className={`w-full ${t.input} pl-11 pr-28 py-3 rounded-xl border text-sm focus:outline-none`} 
              placeholder="Search tracks..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && jam.searchTracks(searchQuery)} 
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {(searchQuery || jam.searchResults.length > 0) && (
                <button 
                  onClick={handleClearSearch} 
                  className={`p-1.5 rounded-lg ${t.muted} hover:text-white transition-colors`}
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => jam.searchTracks(searchQuery)} 
                className="bg-emerald-500 text-zinc-950 text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-emerald-400 active:scale-95 transition-all"
              >
                Search
              </button>
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-2.5">
            {jam.searchResults.map((track) => (
              <div 
                key={track.id} 
                className={`flex justify-between items-center p-3.5 border rounded-xl shadow-sm cursor-pointer transition-colors active:bg-zinc-800/80 ${t.card}`}
                onClick={() => jam.playTrack(track)}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover bg-zinc-800 shrink-0" alt="" />
                  <div className="truncate">
                    <p className="font-bold text-sm truncate">{track.title}</p>
                    <p className={`text-xs ${t.muted} truncate`}>{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                  {/* Play Button - Desktop Only (Mobile uses card tap directly) */}
                  <button 
                    onClick={() => jam.playTrack(track)} 
                    className="hidden md:flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 active:scale-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-zinc-950" />
                    <span>Play</span>
                  </button>

                  {/* Add to Queue Button */}
                  <button 
                    onClick={() => jam.addToQueue(track)} 
                    className={`p-2.5 rounded-xl border ${t.btn} hover:scale-105 active:scale-95 transition-all`}
                    title="Add to Queue"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Room Queue Drawer */}
        <div className={`w-80 border-l pl-6 ${showQueue ? `fixed inset-y-0 right-0 z-50 p-6 w-80 border-l ${t.panel} ${t.bg}` : 'hidden'} lg:flex lg:relative lg:p-0 lg:bg-transparent lg:border-none flex-col overflow-y-auto space-y-3`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2"><ListMusic className="w-4 h-4 text-emerald-500" /><span>Queue ({jam.state.queue.length})</span></div>
            {showQueue && <button onClick={() => setShowQueue(false)} className={`text-[10px] font-bold px-2 py-1 border rounded-md ${t.btn} lg:hidden`}>Close</button>}
          </div>
          {jam.state.queue.map((q, idx) => (
            <div key={`${q.id}-${idx}`} className={`flex items-center gap-2 p-2 border rounded-xl text-xs ${t.card}`}>
              <span className={t.muted}>{idx + 1}</span>
              <img src={q.thumbnail} className="w-8 h-8 rounded object-cover" alt="" />
              <p className="truncate font-semibold flex-1">{q.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Chat Panel */}
      {showChat && (
        <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 border-l shadow-2xl flex flex-col ${t.panel} ${t.bg}`}>
          <div className="p-4 border-b flex items-center justify-between border-zinc-800">
            <div className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-emerald-500" /><h3 className="font-bold text-sm uppercase">Live Chat</h3></div>
            <button onClick={() => setShowChat(false)} className={`p-1.5 rounded-lg border ${t.btn}`}><X className="w-4 h-4" /></button>
          </div>

          <div className="p-3 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-xs text-zinc-400">Name:</span>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className={`w-full px-2.5 py-1 rounded-lg border text-xs font-semibold ${t.input}`} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <p className={`text-xs text-center my-8 ${t.muted}`}>No messages yet. Say hello!</p>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={msg.id || `msg-${idx}`} className="flex flex-col text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-400">{msg.sender}</span>
                    <span className={`text-[10px] ${t.muted}`}>{msg.timestamp}</span>
                  </div>
                  <p className={`p-2.5 rounded-xl border text-xs max-w-[90%] break-words ${t.card}`}>{msg.text}</p>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 flex gap-2">
            <input type="text" placeholder="Type a message..." value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} className={`flex-1 ${t.input} px-3 py-2 rounded-xl text-xs border`} />
            <button type="submit" className="bg-emerald-500 text-zinc-950 p-2.5 rounded-xl hover:bg-emerald-400 transition-transform active:scale-95"><Send className="w-4 h-4 fill-zinc-950" /></button>
          </form>
        </div>
      )}

      <PlayerControls state={jam.state} volume={jam.volume} setVolume={jam.setVolume} togglePlay={jam.togglePlay} skipTrack={jam.skipTrack} seekTo={jam.seekTo} showQueue={showQueue} setShowQueue={setShowQueue} isDarkMode={isDarkMode} t={t} />
    </div>
  );
}