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

    // --- LIVE CHAT LISTENER ---
    socket.on('sendMessage', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;

        const messageData = {
            id: Date.now().toString(),
            sender: data.sender || 'Anonymous',
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Keep the last 50 messages per room to prevent memory leaks
        rooms[currentRoomId].chatHistory.push(messageData);
        if (rooms[currentRoomId].chatHistory.length > 50) {
            rooms[currentRoomId].chatHistory.shift();
        }

        // Broadcast the new message to everyone in the room
        io.to(currentRoomId).emit('newMessage', messageData);
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
                delete rooms[roomId];
            }
        }
    }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Jam Multi-Room Server running on port ${PORT}`));