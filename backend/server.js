const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ytSearch = require('yt-search');
const cors = require('cors');

const app = express();
app.use(cors());

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
            currentTime: roomState.currentTime,
            queue: roomState.queue
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

// Network-independent port handling (Uses dynamic deployment ports or local port 4000)
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Jam Multi-Room Server running on port ${PORT}`));
