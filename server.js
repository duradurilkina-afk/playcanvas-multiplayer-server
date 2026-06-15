const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket']
});
const PORT = process.env.PORT || 80;
let players = {};

io.on('connection', (socket) => {
    console.log('Подключился: ', socket.id);

    players[socket.id] = null;

    socket.on('initPosition', (data) => {
        players[socket.id] = {
            position: data.position,
            rotation: data.rotation,
            speed: 0
        };
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            position: data.position,
            rotation: data.rotation
        });
    });

    socket.on('playerMoved', (data) => {
        // Защита: если игрок почему-то еще не инициализирован, создаем ему структуру
        if (!players[socket.id]) {
            players[socket.id] = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, speed: 0 };
        }

        if (data && data.position) {
            players[socket.id].position = data.position;
            players[socket.id].rotation = data.rotation;

            // Явно собираем чистый объект для рассылки, чтобы избежать мутаций данных
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                position: data.position,
                rotation: data.rotation,
                speed: data.speed || 0
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Отключился: ', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер работает на порту ' + PORT);
});