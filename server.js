const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    if (!rooms[roomId]) rooms[roomId] = new Set();
    rooms[roomId].add(userId);
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);
    socket.emit('all-users', Array.from(rooms[roomId]).filter(id => id !== userId));

    socket.on('offer', data => socket.to(data.target).emit('offer', { sdp: data.sdp, sender: userId }));
    socket.on('answer', data => socket.to(data.target).emit('answer', { sdp: data.sdp, sender: userId }));
    socket.on('ice-candidate', data => socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, sender: userId }));
    socket.on('chat', ({ name, message }) => io.to(roomId).emit('chat', { name, message }));

    socket.on('disconnect', () => {
      rooms[roomId]?.delete(userId);
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
