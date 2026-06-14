const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 80;

let players = {};

io.on('connection', (socket) => {
    console.log('Подключение:', socket.id);

    // Добавляем в список
    players[socket.id] = { position: { x: 0, y: 0, z: 0 } };

    // 1. Новичок получает список ТОЛЬКО СЕЙЧАС (один раз)
    socket.emit('currentPlayers', players);

    // 2. Всем остальным сообщаем о новом игроке
    socket.broadcast.emit('newPlayer', { id: socket.id, position: { x: 0, y: 0, z: 0 } });

    socket.on('disconnect', () => {
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер запущен');
});