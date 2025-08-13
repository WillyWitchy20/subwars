const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the public folder
app.use(express.static('public'));

// Rooms store players and other game state
const rooms = {};

function createRoom(id) {
  rooms[id] = { players: {}, bullets: [] };
}

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

io.on('connection', (socket) => {
  // Host creates a new room
  socket.on('createRoom', () => {
    let id;
    do {
      id = generateRoomId();
    } while (rooms[id]);
    createRoom(id);
    socket.join(id);
    socket.emit('roomCreated', id);
  });

  // Player joins an existing room
  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players[socket.id] = {
      x: Math.random() * 800,
      y: Math.random() * 600,
      angle: 0,
      speed: 0,
      hp: 100,
    };
    socket.join(roomId);
    socket.emit('joined', { id: socket.id });
  });

  // Receive input from players
  socket.on('input', ({ roomId, throttle, turn, ping, fire }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;
    player.angle += turn * 0.05;
    player.speed = throttle * 2;
    // TODO: handle ping and fire
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    for (const id in rooms) {
      const room = rooms[id];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
      }
    }
  });
});

// Game loop: update state and broadcast
setInterval(() => {
  for (const id in rooms) {
    const room = rooms[id];
    for (const pid in room.players) {
      const player = room.players[pid];
      player.x += Math.cos(player.angle) * player.speed;
      player.y += Math.sin(player.angle) * player.speed;
      // Clamp within boundaries
      player.x = Math.max(0, Math.min(800, player.x));
      player.y = Math.max(0, Math.min(600, player.y));
    }
    // Broadcast players state only
    io.to(id).emit('state', { players: room.players });
  }
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
