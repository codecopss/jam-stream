const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const YTMusic = require('ytmusic-api');
const NodeCache = require('node-cache');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['*']
  }
});

const ytmusic = new YTMusic();
const searchCache = new NodeCache({ stdTTL: 3600 });

ytmusic.initialize().then(() => console.log('YT Music Ready')).catch(console.error);

const rooms = {};
const roomIntervals = {}; // Store intervals separately to avoid circular reference crashes!

const getRoom = (id) => {
  if (!rooms[id]) {
    rooms[id] = { 
      currentTrack: null, 
      isPlaying: false, 
      currentTime: 0, 
      queue: [], 
      chatHistory: [] 
    };

    roomIntervals[id] = setInterval(() => {
      const r = rooms[id];
      if (r?.isPlaying && r.currentTrack) {
        if (++r.currentTime >= r.currentTrack.duration) {
          advanceQueue(id);
        } else {
          broadcastState(id);
        }
      }
    }, 1000);
  }
  return rooms[id];
};

const advanceQueue = (id) => {
  const r = rooms[id];
  if (!r) return;
  r.currentTrack = r.queue.shift() || null;
  r.isPlaying = !!r.currentTrack;
  r.currentTime = 0;
  broadcastState(id);
};

const broadcastState = (id) => {
  if (rooms[id]) {
    io.to(id).emit('stateUpdate', rooms[id]);
  }
};

app.get('/api/search', async (req, res) => {
  const q = req.query.q?.trim().toLowerCase();
  if (!q) return res.status(400).send('Missing query');
  if (searchCache.has(q)) return res.json(searchCache.get(q));

  try {
    const songs = await ytmusic.searchSongs(q);
    const tracks = songs.slice(0, 10).map((s) => ({
      id: s.videoId, 
      title: s.name, 
      artist: s.artist?.name || 'Unknown',
      duration: s.duration || 0, 
      thumbnail: s.thumbnails?.pop()?.url || ''
    }));
    searchCache.set(q, tracks);
    res.json(tracks);
  } catch (err) {
    res.status(500).send('Search failed');
  }
});

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('joinRoom', (id) => {
    if (!id) return;
    if (currentRoom) socket.leave(currentRoom);

    currentRoom = id;
    socket.join(id);

    const roomState = getRoom(id);
    socket.emit('stateUpdate', roomState);
  });

  socket.on('sendMessage', (data) => {
    const targetRoom = data?.roomId || currentRoom;
    if (!targetRoom || !data?.text) return;

    const r = getRoom(targetRoom);
    
    const msg = {
      id: data.id || Date.now().toString(),
      sender: data.sender || 'Anonymous',
      text: String(data.text),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (!Array.isArray(r.chatHistory)) r.chatHistory = [];
    r.chatHistory.push(msg);
    if (r.chatHistory.length > 50) r.chatHistory.shift();

    broadcastState(targetRoom);
  });

  socket.on('playTrack', (track) => {
    if (!currentRoom) return;
    const r = getRoom(currentRoom);
    r.currentTrack = track; 
    r.isPlaying = true; 
    r.currentTime = 0;
    broadcastState(currentRoom);
  });

  socket.on('togglePlay', (playing) => {
    if (currentRoom && rooms[currentRoom]) { 
      rooms[currentRoom].isPlaying = playing; 
      broadcastState(currentRoom); 
    }
  });

  socket.on('addToQueue', (track) => {
    if (currentRoom && rooms[currentRoom]) { 
      rooms[currentRoom].queue.push(track); 
      broadcastState(currentRoom); 
    }
  });

  socket.on('trackEnded', () => {
    if (currentRoom) advanceQueue(currentRoom);
  });

  socket.on('disconnect', () => {
    if (currentRoom && (!io.sockets.adapter.rooms.get(currentRoom) || io.sockets.adapter.rooms.get(currentRoom).size === 0)) {
      if (roomIntervals[currentRoom]) {
        clearInterval(roomIntervals[currentRoom]);
        delete roomIntervals[currentRoom];
      }
      delete rooms[currentRoom];
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));