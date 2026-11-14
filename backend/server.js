const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ytSearch = require('yt-search');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    pingTimeout: 30000, // Increase timeout so background tabs don't drop instantly
    pingInterval: 10000
});

let rooms = {};

function getOrCreateRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            currentTrack: null,
            isPlaying: false,
            startTime: 0,       // Absolute timestamp (Date.now()) when playback started
            pausedAt: 0,        // Elapsed time before pause
            queue: [],
            interval: null
        };

        // This interval now only checks if a track finished playing using absolute time
        rooms[roomId].interval = setInterval(() => {
            let room = rooms[roomId];
            if (room && room.isPlaying && room.currentTrack) {
                const elapsed = Math.floor((Date.now() - room.startTime) / 1000);
                
                if (elapsed >= room.currentTrack.duration) {
                    advanceQueue(roomId);
                }
            }
        }, 1000);
    }
    return rooms[roomId];
}

function getCurrentTime(room) {
    if (!room.isPlaying || !room.currentTrack) {
        return room.pausedAt || 0;
    }
    const elapsed = Math.floor((Date.now() - room.startTime) / 1000);
    return Math.min(elapsed, room.currentTrack.duration);
}

function advanceQueue(roomId) {
    let room = rooms[roomId];
    if (!room) return;
    
    if (room.queue.length > 0) {
        room.currentTrack = room.queue.shift();
        room.isPlaying = true;
        room.startTime = Date.now();
        room.pausedAt = 0;
    } else {
        room.currentTrack = null;
        room.isPlaying = false;
        room.startTime = 0;
        room.pausedAt = 0;
    }
    broadcastState(roomId);
}

function broadcastState(roomId) {
    let room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit('stateUpdate', {
        currentTrack: room.currentTrack,
        isPlaying: room.isPlaying,
        currentTime: getCurrentTime(room),
        queue: room.queue
    });
}

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Missing query' });
        const results = await ytSearch(query);
        const tracks = results.videos.slice(0, 10).map(v => ({
            id: v.videoId,
            title: v.title,
            artist: v.author.name,
            duration: v.seconds,
            thumbnail: v.thumbnail
        }));
        res.json(tracks);
    } catch (error) {
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
            currentTime: getCurrentTime(roomState),
            queue: roomState.queue
        });
    });

    socket.on('playTrack', (track) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        let room = rooms[currentRoomId];
        room.currentTrack = track;
        room.isPlaying = true;
        room.startTime = Date.now();
        room.pausedAt = 0;
        broadcastState(currentRoomId);
    });

    socket.on('togglePlay', (playing) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        let room = rooms[currentRoomId];
        
        if (playing) {
            // Resuming: shift start time forward by how much time had already elapsed
            room.startTime = Date.now() - (room.pausedAt * 1000);
            room.isPlaying = true;
        } else {
            // Pausing: save current elapsed time
            room.pausedAt = getCurrentTime(room);
            room.isPlaying = false;
        }
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

    // Handle explicit client requests to resync when tab gains focus back
    socket.on('requestSync', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        socket.emit('stateUpdate', {
            currentTrack: rooms[currentRoomId].currentTrack,
            isPlaying: rooms[currentRoomId].isPlaying,
            currentTime: getCurrentTime(rooms[currentRoomId]),
            queue: rooms[currentRoomId].queue
        });
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
