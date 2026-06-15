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

    // Храним не только позицию, но и поворот
    players[socket.id] = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        speed: 0
    };

    socket.emit('currentPlayers', players);

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

            // Рассылаем данные (позиция, поворот, скорость) всем остальным
            socket.broadcast.emit('playerMoved', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('Отключился:', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});