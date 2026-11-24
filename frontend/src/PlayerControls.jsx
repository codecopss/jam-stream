import React from 'react';
import { Play, Pause, SkipForward, Volume2, ListMusic } from 'lucide-react';

const formatTime = (s) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00';

export const PlayerControls = ({ state, volume, setVolume, togglePlay, skipTrack, seekTo, showQueue, setShowQueue, isDarkMode, t }) => {
  const handleTimelineScrub = (e) => {
    if (!state.currentTrack) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * state.currentTrack.duration);
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t p-4 flex flex-col md:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-stone-200/95 border-stone-300'} backdrop-blur-md z-40 shadow-2xl`}>
      <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-1/3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          {state.currentTrack ? (
            <>
              <img src={state.currentTrack.thumbnail} className="w-11 h-11 rounded-xl object-cover shadow-md bg-zinc-800" alt="" />
              <div className="truncate">
                <p className="text-xs font-bold truncate tracking-tight">{state.currentTrack.title}</p>
                <p className={`text-[10px] ${t.muted} truncate mt-0.5`}>{state.currentTrack.artist}</p>
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
          <button onClick={togglePlay} className="p-2.5 bg-emerald-500 text-zinc-950 rounded-full shadow-lg active:scale-95 transition-transform">
            {state.isPlaying ? <Pause className="w-4 h-4 fill-zinc-950" /> : <Play className="w-4 h-4 fill-zinc-950" />}
          </button>
          <button onClick={skipTrack} className={`${t.muted} hover:text-emerald-500 p-2`}><SkipForward className="w-4 h-4" /></button>
        </div>
        <div className="w-full flex items-center gap-2 text-[10px] font-mono">
          <span className={t.muted}>{formatTime(state.currentTime)}</span>
          <div onClick={handleTimelineScrub} className="flex-1 bg-zinc-700/80 h-1.5 rounded-full cursor-pointer relative">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-100" style={{ width: `${(state.currentTime / (state.currentTrack?.duration || 1)) * 100}%` }} />
          </div>
          <span className={t.muted}>{formatTime(state.currentTrack?.duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full md:w-1/3 justify-end text-xs">
        <Volume2 className={`w-4 h-4 ${t.muted}`} />
        <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(parseInt(e.target.value))} className="w-full md:w-24 accent-emerald-500 h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-700" />
      </div>
    </div>
  );
};