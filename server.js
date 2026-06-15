const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'] // Сервер примет и то, и то, но приоритет за сокетами
});

const PORT = process.env.PORT || 80;
let players = {};

io.on('connection', (socket) => {
    console.log('=== СЕРВЕР: Подключился игрок с ID:', socket.id);

    players[socket.id] = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        speed: 0
    };

    // Отправляем вошедшему список игроков
    socket.emit('currentPlayers', players);

    // Оповещаем остальных
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
    });

    socket.on('playerMoved', (data) => {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            players[socket.id].rotation = data.rotation;
            data.id = socket.id;

            // Транслируем движение остальным
            socket.broadcast.emit('playerMoved', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('=== СЕРВЕР: Отключился игрок с ID:', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('=== СЕРВЕР ЗАПУЩЕН НА ПОРТУ ' + PORT + ' ===');
});