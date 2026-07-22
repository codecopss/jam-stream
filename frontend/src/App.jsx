import React, { useState } from 'react';
import { Search, Plus, ListMusic, X, Radio, Sun, Moon, Volume2, Play, Pause, SkipForward } from 'lucide-react';
import { useJamSocket } from './useJamSocket';

const formatTime = (s) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00';

export default function CompleteJamMusicApp() {
  const jam = useJamSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showQueue, setShowQueue] = useState(false);

  const t = isDarkMode ? {
    bg: 'bg-zinc-950 text-zinc-100', card: 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900/90',
    input: 'bg-zinc-900/90 text-zinc-100 border-zinc-800 focus:ring-zinc-800 focus:border-zinc-700',
    muted: 'text-zinc-400', panel: 'bg-zinc-950/95 border-zinc-800', btn: 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700'
  } : {
    bg: 'bg-stone-100 text-stone-800', card: 'bg-white border-stone-200 shadow-sm hover:bg-stone-50',
    input: 'bg-white text-stone-800 border-stone-300 focus:ring-stone-200 focus:border-stone-400',
    muted: 'text-stone-500', panel: 'bg-stone-100/95 border-stone-300', btn: 'bg-stone-200 border-stone-300 text-stone-800 hover:bg-stone-300'
  };

  const handleTimelineScrub = (e) => {
    if (!jam.state.currentTrack) return;
    const rect = e.currentTarget.getBoundingClientRect();
    jam.seekTo(((e.clientX - rect.left) / rect.width) * jam.state.currentTrack.duration);
  };

  return (
    <div className={`flex flex-col h-screen ${t.bg} font-sans overflow-hidden p-4 md:p-8 relative`}>
      {/* Tiny in-bounds player to prevent browser background throttling */}
      <div 
        id="hidden-youtube-player" 
        className="fixed bottom-0 right-0 w-[1px] h-[1px] opacity-10 pointer-events-none z-[-1]" 
      />

      {/* iOS Audio Unlock Modal Prompt */}
      {!jam.isAudioUnlocked && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm text-center shadow-2xl">
            <Radio className="w-10 h-10 text-emerald-500 mx-auto mb-3 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Tap to Join Room</h3>
            <p className="text-xs text-zinc-400 mb-6">
              iOS Safari requires a direct interaction to enable synchronized audio playback.
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

      {/* Popup Notification */}
      {jam.popupMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-zinc-950 font-bold text-xs px-5 py-3 rounded-xl shadow-xl border border-emerald-400">
          {jam.popupMessage}
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Radio className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl font-bold uppercase tracking-wider">Jamstream</h2>
        </div>
        <div className="flex items-center gap-2">
          <input 
            className={`px-4 py-2 rounded-xl border font-mono text-sm shadow-inner focus:outline-none focus:ring-2 ${t.input}`} 
            value={jam.roomId} 
            onChange={(e) => jam.setRoomId(e.target.value.trim().toLowerCase())} 
            placeholder="Room ID" 
          />
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2.5 rounded-xl border shadow-sm ${t.card}`}>
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
          </button>
        </div>
      </div>

      {/* Body Grid */}
      <div className="flex flex-1 gap-6 overflow-hidden mb-28">
        {/* Search & Results Panel */}
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
            <button onClick={() => jam.searchTracks(searchQuery)} className="absolute right-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-bold px-4 py-1.5 rounded-lg shadow-md transition-all">
              Search
            </button>
          </div>

          {jam.searchResults.length > 0 && (
            <div className="flex justify-end">
              <button onClick={() => jam.setSearchResults([])} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border rounded-lg shadow-sm ${t.btn}`}>
                <X className="w-3.5 h-3.5" /> Clear Results
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {jam.searchResults.map((track) => (
              <div key={track.id} className={`flex justify-between items-center p-3.5 border rounded-xl shadow-sm transition-all ${t.card}`}>
                <div onClick={() => window.innerWidth < 768 && jam.playTrack(track)} className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer md:cursor-default">
                  <img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover shadow-sm bg-zinc-800" alt="" />
                  <div className="truncate">
                    <p className="font-bold text-sm truncate tracking-tight">{track.title}</p>
                    <p className={`text-xs ${t.muted} truncate mt-0.5`}>{track.artist}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => jam.playTrack(track)} className="hidden md:block text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 shadow-md active:scale-95 transition-transform">
                    Play
                  </button>
                  <button onClick={() => jam.addToQueue(track)} className={`p-2.5 rounded-xl border shadow-sm transition-transform active:scale-95 ${t.btn}`}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Queue Drawer / Sidebar */}
        <div className={`w-80 border-l pl-6 ${showQueue ? `fixed inset-y-0 right-0 z-50 p-6 w-80 border-l shadow-2xl ${t.panel} ${t.bg}` : 'hidden'} lg:flex lg:relative lg:p-0 lg:bg-transparent lg:border-none flex-col overflow-y-auto space-y-3`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2"><ListMusic className="w-4 h-4 text-emerald-500" /><span>Queue ({jam.state.queue.length})</span></div>
            {showQueue && <button onClick={() => setShowQueue(false)} className={`text-[10px] font-bold px-2 py-1 border rounded-md shadow-sm ${t.btn} lg:hidden`}>Close</button>}
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

      {/* Persistent Bottom Audio Player Controls */}
      <div className={`fixed bottom-0 left-0 right-0 border-t p-4 flex flex-col md:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-stone-200/95 border-stone-300'} backdrop-blur-md z-40 shadow-2xl`}>
        <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-1/3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {jam.state.currentTrack ? (
              <>
                <img src={jam.state.currentTrack.thumbnail} className="w-11 h-11 rounded-xl object-cover shadow-md bg-zinc-800" alt="" />
                <div className="truncate">
                  <p className="text-xs font-bold truncate tracking-tight">{jam.state.currentTrack.title}</p>
                  <p className={`text-[10px] ${t.muted} truncate mt-0.5`}>{jam.state.currentTrack.artist}</p>
                </div>
              </>
            ) : <p className="text-xs opacity-50 font-medium">No active track</p>}
          </div>
          <button onClick={() => setShowQueue(!showQueue)} className={`p-2.5 rounded-xl border shadow-sm ${t.btn} lg:hidden`}>
            <ListMusic className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5 w-full md:w-1/3">
          <div className="flex gap-4">
            <button onClick={jam.togglePlay} className="p-2.5 bg-emerald-500 text-zinc-950 rounded-full shadow-lg active:scale-95 transition-transform">
              {jam.state.isPlaying ? <Pause className="w-4 h-4 fill-zinc-950" /> : <Play className="w-4 h-4 fill-zinc-950" />}
            </button>
            <button onClick={jam.skipTrack} className={`${t.muted} hover:text-emerald-500 p-2`}><SkipForward className="w-4 h-4" /></button>
          </div>
          <div className="w-full flex items-center gap-2 text-[10px] font-mono">
            <span className={t.muted}>{formatTime(jam.state.currentTime)}</span>
            <div onClick={handleTimelineScrub} className="flex-1 bg-zinc-700/80 h-1.5 rounded-full cursor-pointer relative">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-100" style={{ width: `${(jam.state.currentTime / (jam.state.currentTrack?.duration || 1)) * 100}%` }} />
            </div>
            <span className={t.muted}>{formatTime(jam.state.currentTrack?.duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-1/3 justify-end text-xs">
          <Volume2 className={`w-4 h-4 ${t.muted}`} />
          <input type="range" min="0" max="100" value={jam.volume} onChange={(e) => jam.setVolume(parseInt(e.target.value))} className="w-full md:w-24 accent-emerald-500 h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}