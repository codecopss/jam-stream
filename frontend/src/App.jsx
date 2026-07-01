import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Search, Play, Pause, SquareTerminal, Volume2, Moon, Sun, 
  Layers, Home, Radio, ListMusic, Plus, SkipForward, Music
} from 'lucide-react';

// Dynamic Network URL Detection Engine
const BACKEND_URL = import.meta.env.VITE_API_URL || (
    window.location.hostname === 'localhost' 
        ? 'http://localhost:4000' 
        : `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':4000' : ''}`
);
const socket = io(BACKEND_URL, {
    transports: ['polling', 'websocket'], // Allow HTTP polling first, then upgrade seamlessly
    secure: true,                         // Force secure protocol handling (wss://)
    rejectUnauthorized: false             // Prevents SSL handshake blockages
});

export default function CompleteJamMusicApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const initialRoom = urlParams.get('room') || 'lobby';

    const [roomId, setRoomId] = useState(initialRoom);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [state, setState] = useState({ currentTrack: null, isPlaying: false, currentTime: 0, queue: [] });
    const [volume, setVolume] = useState(50);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false);
    
    const playerRef = useRef(null);
    const isPlayerReady = useRef(false);

    const formatTime = (seconds) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // 1. Sync Room ID adjustments cleanly across URL parameters
    useEffect(() => {
        const url = new URL(window.location);
        url.searchParams.set('room', roomId);
        window.history.pushState({}, '', url);
        
        socket.emit('joinRoom', roomId);
    }, [roomId]);

    // 2. Dynamic Initialization of the Global YouTube IFrame Framework
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                initYoutubePlayer();
            };
        } else {
            initYoutubePlayer();
        }

        function initYoutubePlayer() {
            if (playerRef.current) return;
            playerRef.current = new window.YT.Player('hidden-youtube-player', {
                height: '0',
                width: '0',
                playerVars: { 'controls': 0, 'disablekb': 1, 'modestbranding': 1, 'origin': window.location.origin },
                events: {
                    'onReady': () => {
                        isPlayerReady.current = true;
                        playerRef.current.setVolume(volume);
                    },
                    'onStateChange': (event) => {
                        if (event.data === window.YT.PlayerState.ENDED) {
                            socket.emit('trackEnded');
                        }
                    }
                }
            });
        }
    }, []);

    // 3. High-Frequency Realtime Sync Hub Subscriptions
    useEffect(() => {
        socket.on('stateUpdate', (newState) => {
            if (!newState) return;
            setState(newState);

            if (!isPlayerReady.current || !playerRef.current) return;

            if (newState.currentTrack) {
                const currentVideoUrl = playerRef.current.getVideoUrl() || "";
                if (!currentVideoUrl.includes(newState.currentTrack.id)) {
                    playerRef.current.loadVideoById(newState.currentTrack.id, newState.currentTime);
                }

                const localTime = playerRef.current.getCurrentTime();
                if (Math.abs(localTime - newState.currentTime) > 2.5) {
                    playerRef.current.seekTo(newState.currentTime, true);
                }

                if (newState.isPlaying) {
                    playerRef.current.playVideo();
                } else {
                    playerRef.current.pauseVideo();
                }
            } else {
                playerRef.current.stopVideo();
            }
        });

        return () => {
            socket.off('stateUpdate');
        };
    }, []);

    // 4. Update volume updates dynamically
    useEffect(() => {
        if (isPlayerReady.current && playerRef.current && typeof playerRef.current.setVolume === 'function') {
            playerRef.current.setVolume(volume);
        }
    }, [volume]);

    const handleVolumeChange = (e) => {
        setVolume(parseInt(e.target.value));
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Search failed", error);
        }
    };

    const handleTimelineScrub = (e) => {
        if (!state.currentTrack) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickPositionX = e.clientX - rect.left;
        const totalWidth = rect.width;
        const percentageClicked = clickPositionX / totalWidth;
        const calculatedSeekTargetSeconds = percentageClicked * state.currentTrack.duration;
        
        if (isPlayerReady.current && playerRef.current) {
            playerRef.current.seekTo(calculatedSeekTargetSeconds, true);
        }
    };

    const theme = {
        bg: isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-stone-100 text-stone-800',
        sidebar: isDarkMode ? 'bg-zinc-900/50 border-zinc-800/80' : 'bg-stone-200/60 border-stone-300/60',
        card: isDarkMode ? 'bg-zinc-900/40 border-zinc-900 hover:bg-zinc-900/80' : 'bg-stone-200/30 border-stone-200 hover:bg-stone-200/70',
        input: isDarkMode ? 'bg-zinc-900 text-zinc-100 border-zinc-800 placeholder:text-zinc-500' : 'bg-stone-200/80 text-stone-800 border-stone-300 placeholder:text-stone-400',
        textMuted: isDarkMode ? 'text-zinc-400' : 'text-stone-500',
        player: isDarkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-stone-200/95 border-stone-300/80',
        accent: 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950',
        accentText: 'text-emerald-500'
    };

    return (
        <div className={`flex flex-col h-screen ${theme.bg} font-sans overflow-hidden transition-colors duration-300`}>
            <div id="hidden-youtube-player" className="hidden"></div>

            <div className="flex flex-1 overflow-hidden relative">
                
                {/* Desktop Left Sidebar Navigation */}
                <div className={`w-64 ${theme.sidebar} p-6 flex flex-col justify-between hidden md:flex border-r transition-colors duration-300`}>
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 tracking-tight">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                                    <Radio className="w-4 h-4 text-zinc-950" />
                                </div>
                                <h2 className="text-lg font-bold tracking-wide uppercase">Jamstream</h2>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={`text-[10px] font-bold uppercase tracking-widest block ${theme.textMuted}`}>Your Shared Room ID</label>
                            <input 
                                className={`w-full ${theme.input} px-3 py-2 rounded-lg border font-mono text-sm focus:outline-none`}
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value.trim().toLowerCase())}
                                placeholder="Enter room ID..."
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">💡 Share this browser URL link to let friends join your private room space!</p>
                        </div>

                        <div className="space-y-1.5">
                            <p className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted} px-3 mb-3`}>Discover</p>
                            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition bg-emerald-500/10 text-emerald-500">
                                <Home className="w-4 h-4" /> Home Dashboard
                            </button>
                            <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition ${theme.textMuted} hover:text-emerald-500 hover:bg-emerald-500/5`}>
                                <Radio className="w-4 h-4" /> Public Rooms
                            </button>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${theme.card} transition-colors duration-300`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-[11px] font-medium tracking-wider uppercase ${theme.textMuted}`}>Live Session</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        </div>
                        <p className="text-xs font-semibold flex items-center gap-1.5">
                            <SquareTerminal className="w-3.5 h-3.5 opacity-60" /> Live Sync Active
                        </p>
                    </div>
                </div>

                {/* Main Content Window */}
                <div className="flex-1 p-4 md:p-8 overflow-y-auto pb-32">
                    <div className="flex items-center justify-between gap-4 mb-8">
                        <div className="flex flex-1 items-center gap-3 max-w-xl relative">
                            <Search className={`w-4 h-4 absolute left-4 ${theme.textMuted}`} />
                            <input 
                                className={`w-full ${theme.input} pl-11 pr-24 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10`}
                                placeholder="Search tracks, artists, mixes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button 
                                onClick={handleSearch} 
                                className={`absolute right-1.5 top-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg transition ${theme.accent}`}
                            >
                                Search
                            </button>
                        </div>

                        <button 
                            onClick={() => setIsDarkMode(!isDarkMode)} 
                            className={`p-3 rounded-xl border ${theme.card} transition-all duration-300 hover:scale-105`}
                            aria-label="Toggle Theme Mode"
                        >
                            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
                        </button>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-4 opacity-80">
                            {searchResults.length > 0 ? "Search Results" : "Trending Dynamic Feeds"}
                        </h3>
                        <div className="space-y-2">
                            {searchResults.map(track => (
                                <div key={track.id} className={`flex justify-between items-center p-3 border rounded-xl transition-all ${theme.card}`}>
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className="relative group w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-sm bg-zinc-800">
                                            <img src={track.thumbnail} className="w-12 h-12 object-cover" alt="" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                                <Play className="w-4 h-4 text-white fill-white" />
                                            </div>
                                        </div>
                                        <div className="min-w-0 pr-4">
                                            <p className="font-semibold truncate text-sm">{track.title}</p>
                                            <p className={`text-xs ${theme.textMuted} truncate mt-0.5`}>{track.artist}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => socket.emit('playTrack', track)} 
                                            className="text-xs font-bold px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition"
                                        >
                                            Play
                                        </button>
                                        <button 
                                            onClick={() => socket.emit('addToQueue', track)} 
                                            className={`p-2 rounded-lg border ${theme.card} transition`}
                                            title="Add to Queue"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {searchResults.length === 0 && (
                                <div className={`border border-dashed rounded-2xl p-12 text-center ${theme.textMuted} flex flex-col items-center justify-center`}>
                                    <Music className="w-8 h-8 mb-3 opacity-40" />
                                    <p className="text-sm font-medium">No tracks found. Begin your search query above.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Desktop Sidebar Panel */}
                <div className={`w-80 ${theme.sidebar} border-l p-6 hidden lg:flex flex-col transition-colors duration-300`}>
                    <div className="flex items-center gap-2 mb-6">
                        <Layers className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">Room Playback Queue</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {state.queue && state.queue.length > 0 ? (
                            state.queue.map((queuedTrack, index) => (
                                <div key={queuedTrack.id + '-' + index} className={`flex items-center gap-3 p-2.5 border rounded-xl ${theme.card}`}>
                                    <span className={`text-xs font-bold ${theme.textMuted} w-4 text-center`}>{index + 1}</span>
                                    <img src={queuedTrack.thumbnail} className="w-10 h-10 rounded-lg object-cover shadow-sm bg-zinc-800" alt="" />
                                    <div className="truncate flex-1">
                                        <p className="text-xs font-semibold truncate">{queuedTrack.title}</p>
                                        <p className={`text-[11px] ${theme.textMuted} truncate mt-0.5`}>{queuedTrack.artist}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={`h-40 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-xl ${theme.textMuted}`}>
                                <ListMusic className="w-6 h-6 mb-2 opacity-40" />
                                <p className="text-xs font-medium">The room queue is empty.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Slide-over Drawer */}
                {isMobileQueueOpen && (
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileQueueOpen(false)}>
                        <div className={`absolute right-0 bottom-0 top-0 w-80 ${theme.player} p-6 flex flex-col shadow-2xl`} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-emerald-500" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider">Room Queue</h3>
                                </div>
                                <button className="text-xs font-bold opacity-70" onClick={() => setIsMobileQueueOpen(false)}>Close</button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {state.queue && state.queue.length > 0 ? (
                                    state.queue.map((queuedTrack, index) => (
                                        <div key={queuedTrack.id + '-' + index} className={`flex items-center gap-3 p-2.5 border rounded-xl ${theme.card}`}>
                                            <span className={`text-xs font-bold ${theme.textMuted} w-4 text-center`}>{index + 1}</span>
                                            <img src={queuedTrack.thumbnail} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                            <div className="truncate flex-1">
                                                <p className="text-xs font-semibold truncate">{queuedTrack.title}</p>
                                                <p className={`text-[11px] ${theme.textMuted} truncate`}>{queuedTrack.artist}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-xs opacity-50">Queue is currently empty.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Playback HUD Controller Panel */}
            <div className={`fixed bottom-0 left-0 right-0 h-24 ${theme.player} backdrop-blur-md border-t px-4 md:px-8 flex items-center justify-between z-40 transition-colors duration-300 shadow-xl`}>
                
                <div className="flex items-center gap-3 w-1/3 min-w-[160px] md:min-w-[240px]">
                    {state.currentTrack ? (
                        <>
                            <img src={state.currentTrack.thumbnail} className="w-12 h-12 rounded-xl shadow-md object-cover bg-zinc-800 flex-shrink-0" alt="" />
                            <div className="truncate hidden sm:block">
                                <p className="text-xs font-bold truncate tracking-tight">{state.currentTrack.title}</p>
                                <p className={`text-[11px] ${theme.textMuted} truncate mt-0.5`}>{state.currentTrack.artist}</p>
                            </div>
                        </>
                    ) : (
                        <div className={`text-xs font-medium flex items-center gap-2 ${theme.textMuted}`}>
                            <div className="w-10 h-10 rounded-xl border border-dashed border-zinc-500/30 flex items-center justify-center">
                                <Music className="w-4 h-4 opacity-40" />
                            </div>
                            <span className="hidden sm:inline">No track active</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center gap-2 w-1/3 max-w-xl">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => socket.emit('togglePlay', !state.isPlaying)} 
                            className="w-10 h-10 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-md"
                        >
                            {state.isPlaying ? <Pause className="w-4 h-4 fill-zinc-950" /> : <Play className="w-4 h-4 fill-zinc-950 ml-0.5" />}
                        </button>
                        <button 
                            onClick={() => socket.emit('trackEnded')} 
                            className={`p-2 rounded-lg transition ${theme.textMuted} hover:text-emerald-500`}
                            title="Skip Track"
                        >
                            <SkipForward className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="w-full flex items-center gap-2">
                        <span className={`text-[10px] font-mono ${theme.textMuted} w-8 text-right`}>
                            {formatTime(state.currentTime)}
                        </span>
                        <div 
                            onClick={handleTimelineScrub}
                            className={`flex-1 ${isDarkMode ? 'bg-zinc-800' : 'bg-stone-300'} h-1.5 rounded-full relative group cursor-pointer`}
                        >
                            <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-100 relative" 
                                style={{ width: `${(state.currentTime / (state.currentTrack?.duration || 1)) * 100}%` }} 
                            />
                        </div>
                        <span className={`text-[10px] font-mono ${theme.textMuted} w-8 text-left`}>
                            {formatTime(state.currentTrack?.duration)}
                        </span>
                    </div>
                </div>

                <div className="w-1/3 flex justify-end items-center gap-3">
                    <button 
                        onClick={() => setIsMobileQueueOpen(true)} 
                        className={`p-2 rounded-lg border ${theme.card} lg:hidden transition`}
                    >
                        <ListMusic className="w-4 h-4" />
                    </button>
                    
                    <div className="items-center gap-2.5 hidden md:flex">
                        <Volume2 className={`w-4 h-4 ${theme.textMuted}`} />
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={volume} 
                            onChange={handleVolumeChange}
                            className="w-20 md:w-24 accent-emerald-500 h-1 bg-zinc-700 rounded-lg cursor-pointer appearance-none"
                        />
                        <span className={`text-[11px] font-mono w-8 text-right ${theme.textMuted}`}>{volume}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}