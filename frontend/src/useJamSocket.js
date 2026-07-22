import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:4000' 
    : `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':4000' : ''}`);

const socket = io(BACKEND_URL, { transports: ['polling', 'websocket'], secure: true, rejectUnauthorized: false });

export function useJamSocket() {
  const [roomId, setRoomId] = useState(() => new URLSearchParams(window.location.search).get('room') || 'lobby');
  const [searchResults, setSearchResults] = useState([]);
  const [state, setState] = useState({ currentTrack: null, isPlaying: false, currentTime: 0, queue: [] });
  const [volume, setVolume] = useState(50);
  const [popupMessage, setPopupMessage] = useState('');
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  
  const playerRef = useRef(null);
  const isPlayerReady = useRef(false);

  // Sync Room URL & Socket Join
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url);
    socket.emit('joinRoom', roomId);
  }, [roomId]);

  // YouTube IFrame API Initialization
  useEffect(() => {
    const initPlayer = () => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player('hidden-youtube-player', {
        height: '1', width: '1',
        playerVars: { 
          controls: 0, 
          disablekb: 1, 
          modestbranding: 1, 
          origin: window.location.origin, 
          playsinline: 1 
        },
        events: {
          onReady: () => { 
            isPlayerReady.current = true; 
            playerRef.current.setVolume(volume); 
          },
          onStateChange: (e) => e.data === window.YT.PlayerState.ENDED && socket.emit('trackEnded')
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode.insertBefore(tag, firstScript);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }
  }, []);

  // Sync state when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        socket.emit('requestState', roomId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [roomId]);

  // Socket State Synchronization
  useEffect(() => {
    socket.on('stateUpdate', (newState) => {
      if (!newState) return;
      setState(newState);
      if (!isPlayerReady.current || !playerRef.current) return;

      if (newState.currentTrack) {
        if (!(playerRef.current.getVideoUrl() || "").includes(newState.currentTrack.id)) {
          playerRef.current.loadVideoById(newState.currentTrack.id, newState.currentTime);
        }
        if (Math.abs(playerRef.current.getCurrentTime() - newState.currentTime) > 5.0) {
          playerRef.current.seekTo(newState.currentTime, true);
        }
        newState.isPlaying ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
      } else {
        playerRef.current.stopVideo();
      }
    });

    return () => socket.off('stateUpdate');
  }, []);

  // Volume handler
  useEffect(() => {
    if (isPlayerReady.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  // iOS Safari User Gesture Audio Unlock
  const unlockAudio = () => {
    if (playerRef.current && isPlayerReady.current) {
      playerRef.current.playVideo();
      playerRef.current.pauseVideo();
      setIsAudioUnlocked(true);
    } else {
      setIsAudioUnlocked(true);
    }
  };

  // Actions
  const searchTracks = async (query) => {
    if (!query.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}`);
      setSearchResults(await res.json());
    } catch (e) { console.error("Search failed", e); }
  };

  const addToQueue = (track) => {
    socket.emit('addToQueue', track);
    setPopupMessage(`Added "${track.title}" to queue`);
    setTimeout(() => setPopupMessage(''), 2000);
  };

  const playTrack = (track) => {
    if (!isAudioUnlocked) unlockAudio();
    socket.emit('playTrack', track);
  };

  const togglePlay = () => {
    if (!isAudioUnlocked) unlockAudio();
    socket.emit('togglePlay', !state.isPlaying);
  };

  const skipTrack = () => socket.emit('trackEnded');
  const seekTo = (seconds) => isPlayerReady.current && playerRef.current?.seekTo(seconds, true);

  return {
    roomId, setRoomId,
    searchResults, setSearchResults, searchTracks,
    state, volume, setVolume,
    popupMessage,
    isAudioUnlocked, unlockAudio,
    addToQueue, playTrack, togglePlay, skipTrack, seekTo
  };
}