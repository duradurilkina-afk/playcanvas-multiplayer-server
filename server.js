const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 80;

// Храним список подключенных игроков в памяти сервера
let players = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился. ID:', socket.id);
    players[socket.id] = { position: { x: 0, y: 0, z: 0 } };

    // 1. Отправляем новичку список всех, кто УЖЕ играет
    socket.emit('currentPlayers', players);

    // 2. Оповещаем остальных о приходе новичка
    socket.broadcast.emit('playerJoined', {
        id: socket.id,
        position: { x: 0, y: 0, z: 0 }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});