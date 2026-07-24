const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const YTMusic = require('ytmusic-api');
const NodeCache = require('node-cache');
const cors = require('cors');

const app = express();
app.use(cors());

// Initialize YouTube Music API & In-Memory Cache (1 hour TTL)
const ytmusic = new YTMusic();
const searchCache = new NodeCache({ stdTTL: 3600 });

(async () => {
    try {
        await ytmusic.initialize();
        console.log('YouTube Music API initialized successfully');
    } catch (err) {
        console.error('Failed to initialize YouTube Music API:', err);
    }
})();

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let rooms = {};

function getOrCreateRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            currentTrack: null,
            isPlaying: false,
            currentTime: 0,
            queue: [],
            chatHistory: [], // Added chat storage per room
            chatTimeout: null, // Timer for 10-minute chat clearing
            interval: null
        };

        rooms[roomId].interval = setInterval(() => {
            let room = rooms[roomId];
            if (room && room.isPlaying && room.currentTrack) {
                room.currentTime += 1;
                
                if (room.currentTime >= room.currentTrack.duration) {
                    advanceQueue(roomId);
                } else {
                    broadcastState(roomId);
                }
            }
        }, 1000);
    }
    return rooms[roomId];
}

function resetChatInactivityTimer(roomId) {
    let room = rooms[roomId];
    if (!room) return;

    if (room.chatTimeout) clearTimeout(room.chatTimeout);

    // Auto-clear chat after 10 minutes (600,000 ms) of inactivity
    room.chatTimeout = setTimeout(() => {
        if (rooms[roomId]) {
            rooms[roomId].chatHistory = [];
            broadcastState(roomId);
            console.log(`[Chat] Room ${roomId} chat history auto-cleared due to 10m inactivity.`);
        }
    }, 10 * 60 * 1000);
}

function advanceQueue(roomId) {
    let room = rooms[roomId];
    if (!room) return;
    
    if (room.queue.length > 0) {
        room.currentTrack = room.queue.shift();
        room.isPlaying = true;
        room.currentTime = 0;
    } else {
        room.currentTrack = null;
        room.isPlaying = false;
        room.currentTime = 0;
    }
    broadcastState(roomId);
}

function broadcastState(roomId) {
    let room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit('stateUpdate', {
        currentTrack: room.currentTrack,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime,
        queue: room.queue,
        chatHistory: room.chatHistory // Include chat history in room updates
    });
}

// OPTIMIZED FAST & CLEAN MUSIC SEARCH ENDPOINT
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q?.trim().toLowerCase();
        if (!query) return res.status(400).json({ error: 'Missing query' });

        // 1. Check cache for instant sub-10ms response
        const cachedResults = searchCache.get(query);
        if (cachedResults) {
            return res.json(cachedResults);
        }

        // 2. Query YouTube Music for clean song tracks
        const songs = await ytmusic.searchSongs(query);

        // 3. Map clean track payload preserving your exact room track schema
        const tracks = songs.slice(0, 10).map(s => ({
            id: s.videoId,
            title: s.name,
            artist: s.artist?.name || 'Unknown Artist',
            duration: s.duration || 0,
            thumbnail: s.thumbnails?.pop()?.url || ''
        }));

        // 4. Store in cache
        searchCache.set(query, tracks);

        res.json(tracks);
    } catch (error) {
        console.error('Search endpoint error:', error);
        res.status(500).send('Error searching');
    }
});

io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('joinRoom', (roomId) => {
        if (!roomId) return;

        if (currentRoomId) {
            socket.leave(currentRoomId);
            cleanUpRoomIfEmpty(currentRoomId);
        }

        currentRoomId = roomId;
        socket.join(roomId);
        
        let roomState = getOrCreateRoom(roomId);
        
        socket.emit('stateUpdate', {
            currentTrack: roomState.currentTrack,
            isPlaying: roomState.isPlaying,
            currentTime: roomState.currentTime,
            queue: roomState.queue,
            chatHistory: roomState.chatHistory
        });
    });

    socket.on('playTrack', (track) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        rooms[currentRoomId].currentTrack = track;
        rooms[currentRoomId].isPlaying = true;
        rooms[currentRoomId].currentTime = 0;
        broadcastState(currentRoomId);
    });

    socket.on('togglePlay', (playing) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        rooms[currentRoomId].isPlaying = playing;
        broadcastState(currentRoomId);
    });

    socket.on('addToQueue', (track) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        rooms[currentRoomId].queue.push(track);
        broadcastState(currentRoomId);
    });

    socket.on('trackEnded', () => {
        if (!currentRoomId) return;
        advanceQueue(currentRoomId);
    });

    // --- FIXED LIVE CHAT LISTENER ---
    socket.on('sendMessage', (data) => {
        // Resolve targetRoomId from payload or socket closure
        const targetRoomId = data.roomId || currentRoomId;

        if (!targetRoomId) {
            console.warn('[sendMessage] Skipped: No roomId provided or active on socket.');
            return;
        }

        // Ensure room exists
        const room = getOrCreateRoom(targetRoomId);

        // Ensure current socket is joined to room
        if (currentRoomId !== targetRoomId) {
            socket.join(targetRoomId);
            currentRoomId = targetRoomId;
        }

        const messageData = {
            id: data.id || Date.now().toString(),
            sender: data.sender || 'Anonymous',
            text: data.text,
            timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Safety check for chatHistory array
        if (!Array.isArray(room.chatHistory)) {
            room.chatHistory = [];
        }

        // Keep last 50 messages to prevent memory leaks
        room.chatHistory.push(messageData);
        if (room.chatHistory.length > 50) {
            room.chatHistory.shift();
        }

        // Reset the 10-minute inactivity timer
        resetChatInactivityTimer(targetRoomId);

        // Broadcast the new message to everyone in the room (including sender)
        io.to(targetRoomId).emit('newMessage', messageData);
    });

    socket.on('disconnect', () => {
        if (currentRoomId) {
            cleanUpRoomIfEmpty(currentRoomId);
        }
    });

    function cleanUpRoomIfEmpty(roomId) {
        const clients = io.sockets.adapter.rooms.get(roomId);
        if (!clients || clients.size === 0) {
            if (rooms[roomId]) {
                clearInterval(rooms[roomId].interval);
                if (rooms[roomId].chatTimeout) clearTimeout(rooms[roomId].chatTimeout);
                delete rooms[roomId];
            }
        }
    }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Jam Multi-Room Server running on port ${PORT}`));