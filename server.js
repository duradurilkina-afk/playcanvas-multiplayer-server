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

    // Создаем пустую запись, ждем координат инициализации
    players[socket.id] = null;

    socket.on('initPosition', (data) => {
        players[socket.id] = {
            position: data.position,
            rotation: data.rotation,
            speed: 0
        };
        // Отдаем вошедшему список текущих игроков
        socket.emit('currentPlayers', players);
        // Оповещаем остальных с правильными координатами
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            position: data.position,
            rotation: data.rotation
        });
    });

    socket.on('playerMoved', (data) => {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            players[socket.id].rotation = data.rotation;
            data.id = socket.id;
            socket.broadcast.emit('playerMoved', data);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер работает на порту ' + PORT);
});