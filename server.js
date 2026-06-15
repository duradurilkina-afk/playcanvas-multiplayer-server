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

    // Сразу создаем базовый объект, чтобы ПРИНЦИПИАЛЬНО избежать значения null
    players[socket.id] = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, speed: 0 };

    socket.on('initPosition', (data) => {
        if (data) {
            players[socket.id] = {
                position: data.position || { x: 0, y: 0, z: 0 },
                rotation: data.rotation || { x: 0, y: 0, z: 0 },
                speed: 0
            };
            socket.emit('currentPlayers', players);
            socket.broadcast.emit('newPlayer', {
                id: socket.id,
                position: players[socket.id].position,
                rotation: players[socket.id].rotation
            });
        }
    });

    socket.on('playerMoved', (data) => {
        if (data && data.position) {
            // Убрали 'if (players[socket.id])' — сервер теперь безусловно обновляет и транслирует данные
            players[socket.id] = {
                position: data.position,
                rotation: data.rotation,
                speed: data.speed || 0
            };

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