import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:4000' 
    : `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':4000' : ''}`);

const isSecure = window.location.protocol === 'https:';

const socket = io(BACKEND_URL, { 
  transports: ['polling', 'websocket'], 
  secure: isSecure, 
  rejectUnauthorized: false 
});

export function useJamSocket() {
  const [roomId, setRoomId] = useState(() => new URLSearchParams(window.location.search).get('room') || 'lobby');
  const [searchResults, setSearchResults] = useState([]);
  const [state, setState] = useState({ currentTrack: null, isPlaying: false, currentTime: 0, queue: [], chatHistory: [] });
  const [currentTime, setCurrentTime] = useState(0);
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

  // YouTube IFrame API Initialization with Tab-Switch Pause Guard
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
          onStateChange: (e) => {
            // Track ended -> advance room queue only when tab is visible
            if (e.data === window.YT.PlayerState.ENDED && !document.hidden) {
              socket.emit('trackEnded');
            }
            // Ignore auto-pauses triggered by browser tab background throttling
            if (e.data === window.YT.PlayerState.PAUSED && document.hidden) {
              return;
            }
          }
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
        socket.emit('joinRoom', roomId);
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
      setCurrentTime(newState.currentTime || 0);
      if (!isPlayerReady.current || !playerRef.current) return;

      if (newState.currentTrack) {
        const currentUrl = playerRef.current.getVideoUrl ? playerRef.current.getVideoUrl() : '';
        const isSameVideo = currentUrl.includes(newState.currentTrack.id);

        if (!isSameVideo) {
          playerRef.current.loadVideoById(newState.currentTrack.id, newState.currentTime || 0);
        } else if (
          !document.hidden &&
          typeof newState.currentTime === 'number' &&
          Math.abs(playerRef.current.getCurrentTime() - newState.currentTime) > 5.0
        ) {
          playerRef.current.seekTo(newState.currentTime, true);
        }
        newState.isPlaying ? playerRef.current.playVideo() : playerRef.current.pauseVideo();
      } else {
        setCurrentTime(0);
        playerRef.current.stopVideo();
      }
    });

    return () => socket.off('stateUpdate');
  }, []);

  // Real-time timeline progression while playing
  useEffect(() => {
    if (!state.isPlaying || !state.currentTrack) {
      if (!state.currentTrack) setCurrentTime(0);
      return;
    }

    const interval = setInterval(() => {
      const ytTime = isPlayerReady.current && playerRef.current?.getCurrentTime
        ? playerRef.current.getCurrentTime()
        : null;

      if (typeof ytTime === 'number' && !Number.isNaN(ytTime) && ytTime > 0) {
        setCurrentTime(ytTime);
      } else {
        setCurrentTime((prev) => prev + 0.5);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [state.isPlaying, state.currentTrack?.id]);

  // Volume handler
  useEffect(() => {
    if (isPlayerReady.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  // iOS Safari / Mobile Gesture Audio Unlock
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

  const seekTo = (seconds) => {
    if (!isPlayerReady.current || !playerRef.current?.seekTo) return;
    playerRef.current.seekTo(seconds, true);
    setCurrentTime(seconds);
  };

  return {
    socket,
    playerRef,
    roomId, setRoomId,
    searchResults, setSearchResults, searchTracks,
    state: { ...state, currentTime },
    currentTime,
    volume, setVolume,
    popupMessage,
    isAudioUnlocked, unlockAudio,
    addToQueue, playTrack, togglePlay, skipTrack, seekTo
  };
}
