import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, ListMusic, X, Radio, Send, MessageSquare, UserCheck } from 'lucide-react';
import { useJamSocket } from './useJamSocket';
import { Header } from './Header';
import { PlayerControls } from './PlayerControls';

export default function CompleteJamMusicApp() {
  const jam = useJamSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showQueue, setShowQueue] = useState(false);

  // --- Chat State & Auto-Clear Logic ---
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [userName, setUserName] = useState('User_' + Math.floor(1000 + Math.random() * 9000));
  const chatEndRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  // Reset 10-minute inactivity timer on frontend
  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      setChatMessages([]);
    }, 10 * 60 * 1000); // 10 minutes
  };

  // Sync historical chat from room state when connecting or switching rooms
  useEffect(() => {
    if (jam.state?.chatHistory) {
      setChatMessages(jam.state.chatHistory);
      resetInactivityTimer();
    }
  }, [jam.state?.chatHistory]);

  // Listen for incoming room-wide broadcast messages from socket
  useEffect(() => {
    if (!jam.socket) return;

    const handleNewMessage = (msg) => {
      setChatMessages((prev) => {
        // Prevent duplicate rendering if already added locally
        const exists = prev.some(
          (m) => m.id === msg.id || (m.text === msg.text && m.sender === msg.sender && m.timestamp === msg.timestamp)
        );
        if (exists) return prev;
        return [...prev, msg];
      });
      resetInactivityTimer();
    };

    jam.socket.on('newMessage', handleNewMessage);

    return () => {
      jam.socket.off('newMessage', handleNewMessage);
    };
  }, [jam.socket]);

  // Auto-scroll chat drawer on new messages
  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Send message through socket to room
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    const messageData = {
      id: Date.now().toString(),
      roomId: jam.roomId,
      sender: userName.trim() || 'Anonymous',
      text: newMessageText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // 1. Emit message through socket to server
    if (jam.socket) {
      jam.socket.emit('sendMessage', messageData);
    }

    // 2. Optimistic UI update for immediate response on sender's screen
    setChatMessages((prev) => [...prev, messageData]);

    setNewMessageText('');
    resetInactivityTimer();
  };

  const t = isDarkMode ? {
    bg: 'bg-zinc-950 text-zinc-100', card: 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900/90',
    input: 'bg-zinc-900/90 text-zinc-100 border-zinc-800 focus:ring-zinc-800 focus:border-zinc-700',
    muted: 'text-zinc-400', panel: 'bg-zinc-950/95 border-zinc-800', btn: 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700'
  } : {
    bg: 'bg-stone-100 text-stone-800', card: 'bg-white border-stone-200 shadow-sm hover:bg-stone-50',
    input: 'bg-white text-stone-800 border-stone-300 focus:ring-stone-200 focus:border-stone-400',
    muted: 'text-stone-500', panel: 'bg-stone-100/95 border-stone-300', btn: 'bg-stone-200 border-stone-300 text-stone-800 hover:bg-stone-300'
  };

  return (
    <div className={`flex flex-col h-screen ${t.bg} font-sans overflow-hidden p-4 md:p-8 relative`}>
      {/* Background YouTube iframe anchor */}
      <div 
        id="hidden-youtube-player" 
        className="fixed bottom-0 right-0 w-[1px] h-[1px] opacity-10 pointer-events-none z-[-1]" 
      />

      {/* iOS Audio Unlock Modal */}
      {!jam.isAudioUnlocked && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm text-center shadow-2xl">
            <Radio className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Tap to Join Room</h3>
            <p className="text-xs text-zinc-400 mb-6">
              iOS Safari requires direct interaction to enable synchronized audio playback.
            </p>
            <button 
              onClick={jam.unlockAudio}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-xl shadow-lg transition-transform active:scale-95"
            >
              Enable Audio & Sync
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      {jam.popupMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-zinc-950 font-bold text-xs px-5 py-3 rounded-xl shadow-xl border border-emerald-400">
          {jam.popupMessage}
        </div>
      )}

      {/* Top Header Navigation Component */}
      <Header 
        roomId={jam.roomId} 
        setRoomId={jam.setRoomId} 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
        showChat={showChat}
        setShowChat={setShowChat}
        t={t} 
      />

      {/* Body Section */}
      <div className="flex flex-1 gap-6 overflow-hidden mb-28 relative">
        {/* Track Search & Results Grid */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex gap-2 relative items-center">
            <Search className={`w-4 h-4 absolute left-4 ${t.muted}`} />
            <input 
              className={`w-full ${t.input} pl-11 pr-24 py-3 rounded-xl border text-sm shadow-inner focus:outline-none focus:ring-2`} 
              placeholder="Search tracks..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && jam.searchTracks(searchQuery)} 
            />
            <button 
              onClick={() => jam.searchTracks(searchQuery)} 
              className="absolute right-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-bold px-4 py-1.5 rounded-lg shadow-md transition-all"
            >
              Search
            </button>
          </div>

          {jam.searchResults.length > 0 && (
            <div className="flex justify-end">
              <button 
                onClick={() => jam.setSearchResults([])} 
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border rounded-lg shadow-sm ${t.btn}`}
              >
                <X className="w-3.5 h-3.5" /> Clear Results
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {jam.searchResults.map((track) => (
              <div key={track.id} className={`flex justify-between items-center p-3.5 border rounded-xl shadow-sm transition-all ${t.card}`}>
                <div 
                  onClick={() => window.innerWidth < 768 && jam.playTrack(track)} 
                  className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer md:cursor-default"
                >
                  <img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover shadow-sm bg-zinc-800" alt="" />
                  <div className="truncate">
                    <p className="font-bold text-sm truncate tracking-tight">{track.title}</p>
                    <p className={`text-xs ${t.muted} truncate mt-0.5`}>{track.artist}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => jam.playTrack(track)} 
                    className="hidden md:block text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 shadow-md active:scale-95 transition-transform"
                  >
                    Play
                  </button>
                  <button 
                    onClick={() => jam.addToQueue(track)} 
                    className={`p-2.5 rounded-xl border shadow-sm transition-transform active:scale-95 ${t.btn}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Room Queue Drawer */}
        <div className={`w-80 border-l pl-6 ${showQueue ? `fixed inset-y-0 right-0 z-50 p-6 w-80 border-l shadow-2xl ${t.panel} ${t.bg}` : 'hidden'} lg:flex lg:relative lg:p-0 lg:bg-transparent lg:border-none flex-col overflow-y-auto space-y-3`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-emerald-500" />
              <span>Queue ({jam.state.queue.length})</span>
            </div>
            {showQueue && (
              <button onClick={() => setShowQueue(false)} className={`text-[10px] font-bold px-2 py-1 border rounded-md shadow-sm ${t.btn} lg:hidden`}>
                Close
              </button>
            )}
          </div>
          {jam.state.queue.map((q, idx) => (
            <div key={`${q.id}-${idx}`} className={`flex items-center gap-2 p-2 border rounded-xl text-xs ${t.card}`}>
              <span className={t.muted}>{idx + 1}</span>
              <img src={q.thumbnail} className="w-8 h-8 rounded object-cover shadow-sm" alt="" />
              <p className="truncate font-semibold flex-1">{q.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Room Chat Drawer */}
      {showChat && (
        <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 border-l shadow-2xl flex flex-col ${t.panel} ${t.bg}`}>
          {/* Top Chat Header */}
          <div className="p-4 border-b flex items-center justify-between border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-sm tracking-wide uppercase">Live Room Chat</h3>
            </div>
            <button 
              onClick={() => setShowChat(false)} 
              className={`p-1.5 rounded-lg border shadow-sm ${t.btn}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Editable Username Bar */}
          <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-xs text-zinc-400 shrink-0">Name:</span>
            <input 
              type="text" 
              value={userName} 
              onChange={(e) => setUserName(e.target.value)} 
              placeholder="Your display name"
              className={`w-full px-2.5 py-1 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-1 ${t.input}`}
            />
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <p className={`text-xs text-center my-8 ${t.muted}`}>No messages yet. Say hello!</p>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id || Math.random()} className="flex flex-col text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-400">{msg.sender}</span>
                    <span className={`text-[10px] ${t.muted}`}>{msg.timestamp}</span>
                  </div>
                  <p className={`p-2.5 rounded-xl border text-xs max-w-[90%] break-words ${t.card}`}>
                    {msg.text}
                  </p>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 flex gap-2">
            <input 
              type="text"
              placeholder="Type a message..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              className={`flex-1 ${t.input} px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1`}
            />
            <button 
              type="submit"
              className="bg-emerald-500 text-zinc-950 p-2.5 rounded-xl shadow-md hover:bg-emerald-400 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 fill-zinc-950" />
            </button>
          </form>
        </div>
      )}

      {/* Bottom Audio Player Controls */}
      <PlayerControls 
        state={jam.state}
        volume={jam.volume}
        setVolume={jam.setVolume}
        togglePlay={jam.togglePlay}
        skipTrack={jam.skipTrack}
        seekTo={jam.seekTo}
        showQueue={showQueue}
        setShowQueue={setShowQueue}
        isDarkMode={isDarkMode}
        t={t}
      />
    </div>
  );
}