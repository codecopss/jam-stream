import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Search, Play, Pause, Radio, ListMusic, Plus, SkipForward, Music, Sun, Moon, Volume2, X } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:4000' : `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':4000' : ''}`);
const socket = io(BACKEND_URL, { transports: ['polling', 'websocket'], secure: true, rejectUnauthorized: false });

export default function CompleteJamMusicApp() {
    const [roomId, setRoomId] = useState(new URLSearchParams(window.location.search).get('room') || 'lobby');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [state, setState] = useState({ currentTrack: null, isPlaying: false, currentTime: 0, queue: [] });
    const [volume, setVolume] = useState(50);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [showQueue, setShowQueue] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const playerRef = useRef(null);
    const isPlayerReady = useRef(false);

    const formatTime = (s) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00';

    useEffect(() => {
        const url = new URL(window.location);
        url.searchParams.set('room', roomId);
        window.history.pushState({}, '', url);
        socket.emit('joinRoom', roomId);
    }, [roomId]);

    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
            window.onYouTubeIframeAPIReady = initPlayer;
        } else { initPlayer(); }

        function initPlayer() {
            if (playerRef.current) return;
            playerRef.current = new window.YT.Player('hidden-youtube-player', {
                height: '4', width: '4', playerVars: { 'controls': 0, 'disablekb': 1, 'modestbranding': 1, 'origin': window.location.origin, 'playsinline': 1 },
                events: { 'onReady': () => { isPlayerReady.current = true; playerRef.current.setVolume(volume); }, 'onStateChange': (e) => e.data === window.YT.PlayerState.ENDED && socket.emit('trackEnded') }
            });
        }
    }, []);

    useEffect(() => {
        socket.on('stateUpdate', (newState) => {
            if (!newState) return;
            setState(newState);
            if (!isPlayerReady.current || !playerRef.current) return;
            if (newState.currentTrack) {
                if (!(playerRef.current.getVideoUrl() || "").includes(newState.currentTrack.id)) playerRef.current.loadVideoById(newState.currentTrack.id, newState.currentTime);
                if (Math.abs(playerRef.current.getCurrentTime() - newState.currentTime) > 5.0) playerRef.current.seekTo(newState.currentTime, true);
                newState.isPlaying ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
            } else { playerRef.current.stopVideo(); }
        });
        return () => socket.off('stateUpdate');
    }, []);

    useEffect(() => { if (isPlayerReady.current && playerRef.current?.setVolume) playerRef.current.setVolume(volume); }, [volume]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(searchQuery)}`);
            setSearchResults(await res.json());
        } catch (e) { console.error("Search failed", e); }
    };

    const handleAddToQueue = (track) => {
        socket.emit('addToQueue', track);
        setPopupMessage(`Added "${track.title}" to queue`);
        setTimeout(() => setPopupMessage(''), 2000);
    };

    const handleTimelineScrub = (e) => {
        if (!state.currentTrack || !isPlayerReady.current || !playerRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        playerRef.current.seekTo(((e.clientX - rect.left) / rect.width) * state.currentTrack.duration, true);
    };

    const t = isDarkMode ? { bg: 'bg-zinc-950 text-zinc-100', card: 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900/90', input: 'bg-zinc-900/90 text-zinc-100 border-zinc-800 focus:ring-zinc-800 focus:border-zinc-700', muted: 'text-zinc-400', panel: 'bg-zinc-950/95 border-zinc-800', btn: 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700' } : { bg: 'bg-stone-100 text-stone-800', card: 'bg-white border-stone-200 shadow-sm hover:bg-stone-50', input: 'bg-white text-stone-800 border-stone-300 focus:ring-stone-200 focus:border-stone-400', muted: 'text-stone-500', panel: 'bg-stone-100/95 border-stone-300', btn: 'bg-stone-200 border-stone-300 text-stone-800 hover:bg-stone-300' };

    return (
        <div className={`flex flex-col h-screen ${t.bg} font-sans overflow-hidden p-4 md:p-8 relative`}>
            <div id="hidden-youtube-player" style={{ position: 'fixed', left: '-9999px', top: '0', width: '4px', height: '4px', pointerEvents: 'none' }}></div>
            
            {popupMessage && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-zinc-950 font-bold text-xs px-5 py-3 rounded-xl shadow-xl border border-emerald-400">{popupMessage}</div>}

            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2"><Radio className="w-6 h-6 text-emerald-500" /><h2 className="text-xl font-bold uppercase tracking-wider">Jamstream</h2></div>
                <div className="flex items-center gap-2">
                    <input className={`px-4 py-2 rounded-xl border font-mono text-sm shadow-inner focus:outline-none focus:ring-2 ${t.input}`} value={roomId} onChange={(e) => setRoomId(e.target.value.trim().toLowerCase())} placeholder="Room ID" />
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2.5 rounded-xl border shadow-sm ${t.card}`}>{isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}</button>
                </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden mb-28">
                <div className="flex-1 overflow-y-auto space-y-4">
                    <div className="flex gap-2 relative items-center">
                        <Search className={`w-4 h-4 absolute left-4 ${t.muted}`} />
                        <input className={`w-full ${t.input} pl-11 pr-24 py-3 rounded-xl border text-sm shadow-inner focus:outline-none focus:ring-2`} placeholder="Search tracks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                        <button onClick={handleSearch} className="absolute right-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-bold px-4 py-1.5 rounded-lg shadow-md transition-all">Search</button>
                    </div>
                    {searchResults.length > 0 && <div className="flex justify-end"><button onClick={() => setSearchResults([])} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border rounded-lg shadow-sm ${t.btn}`}><X className="w-3.5 h-3.5" /> Clear Results</button></div>}
                    <div className="space-y-2.5">
                        {searchResults.map(track => (
                            <div key={track.id} className={`flex justify-between items-center p-3.5 border rounded-xl shadow-sm transition-all ${t.card}`}>
                                <div onClick={() => window.innerWidth < 768 && socket.emit('playTrack', track)} className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer md:cursor-default"><img src={track.thumbnail} className="w-12 h-12 rounded-xl object-cover shadow-sm bg-zinc-800" />
                                    <div className="truncate"><p className="font-bold text-sm truncate tracking-tight">{track.title}</p><p className={`text-xs ${t.muted} truncate mt-0.5`}>{track.artist}</p></div>
                                </div>
                                <div className="flex gap-2 shrink-0"><button onClick={() => socket.emit('playTrack', track)} className="hidden md:block text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 shadow-md active:scale-95 transition-transform">Play</button>
                                <button onClick={() => handleAddToQueue(track)} className={`p-2.5 rounded-xl border shadow-sm transition-transform active:scale-95 ${t.btn}`}><Plus className="w-4 h-4" /></button></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`w-80 border-l pl-6 ${showQueue ? `fixed inset-y-0 right-0 z-50 p-6 w-80 border-l shadow-2xl ${t.panel} ${t.bg}` : 'hidden'} lg:flex lg:relative lg:p-0 lg:bg-transparent lg:border-none flex-col overflow-y-auto space-y-3`}>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider"><div className="flex items-center gap-2"><ListMusic className="w-4 h-4 text-emerald-500" /><span>Queue ({state.queue.length})</span></div>{showQueue && <button onClick={() => setShowQueue(false)} className={`text-[10px] font-bold px-2 py-1 border rounded-md shadow-sm ${t.btn} lg:hidden`}>Close</button>}</div>
                    {state.queue.map((q, idx) => (
                        <div key={q.id + '-' + idx} className={`flex items-center gap-2 p-2 border rounded-xl text-xs ${t.card}`}><span className={t.muted}>{idx + 1}</span><img src={q.thumbnail} className="w-8 h-8 rounded object-cover shadow-sm" /><p className="truncate font-semibold flex-1">{q.title}</p></div>
                    ))}
                </div>
            </div>

            <div className={`fixed bottom-0 left-0 right-0 border-t p-4 flex flex-col md:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-stone-200/95 border-stone-300'} backdrop-blur-md z-40 shadow-2xl`}>
                <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-1/3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">{state.currentTrack ? (<><img src={state.currentTrack.thumbnail} className="w-11 h-11 rounded-xl object-cover shadow-md bg-zinc-800" /><div className="truncate"><p className="text-xs font-bold truncate tracking-tight">{state.currentTrack.title}</p><p className={`text-[10px] ${t.muted} truncate mt-0.5`}>{state.currentTrack.artist}</p></div></>) : <p className="text-xs opacity-50 font-medium">No active track</p>}</div>
                    <button onClick={() => setShowQueue(!showQueue)} className={`p-2.5 rounded-xl border shadow-sm ${t.btn} lg:hidden`}><ListMusic className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-col items-center gap-1.5 w-full md:w-1/3">
                    <div className="flex gap-4"><button onClick={() => socket.emit('togglePlay', !state.isPlaying)} className="p-2.5 bg-emerald-500 text-zinc-950 rounded-full shadow-lg active:scale-95 transition-transform">{state.isPlaying ? <Pause className="w-4 h-4 fill-zinc-950" /> : <Play className="w-4 h-4 fill-zinc-950" />}</button>
                    <button onClick={() => socket.emit('trackEnded')} className={`${t.muted} hover:text-emerald-500 p-2`}><SkipForward className="w-4 h-4" /></button></div>
                    <div className="w-full flex items-center gap-2 text-[10px] font-mono">
                        <span className={t.muted}>{formatTime(state.currentTime)}</span>
                        <div onClick={handleTimelineScrub} className="flex-1 bg-zinc-700/80 h-1.5 rounded-full cursor-pointer relative"><div className="bg-emerald-500 h-full rounded-full transition-all duration-100" style={{ width: `${(state.currentTime / (state.currentTrack?.duration || 1)) * 100}%` }} /></div>
                        <span className={t.muted}>{formatTime(state.currentTrack?.duration)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 w-full md:w-1/3 justify-end text-xs"><Volume2 className={`w-4 h-4 ${t.muted}`} /><input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(parseInt(e.target.value))} className="w-full md:w-24 accent-emerald-500 h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-700" /></div>
            </div>
        </div>
    );
}