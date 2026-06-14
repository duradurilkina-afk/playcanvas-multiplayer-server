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

    players[socket.id] = { position: { x: 0, y: 0, z: 0 } };

    // Отправляем новичку список всех уже играющих
    socket.emit('currentPlayers', players);

    // Оповещаем остальных о новом игроке
    socket.broadcast.emit('newPlayer', { id: socket.id, position: { x: 0, y: 0, z: 0 } });

    // --- ВОТ СЮДА ВСТАВЛЯЕМ ОБРАБОТЧИК ДВИЖЕНИЯ ---
    socket.on('playerMoved', (data) => {
        if (players[socket.id]) {
            players[socket.id].position = data.position;
            data.id = socket.id;
            // Рассылаем всем остальным новые координаты
            socket.broadcast.emit('playerMoved', data);
        }
    });
    // ----------------------------------------------

    socket.on('disconnect', () => {
        console.log('Отключился:', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});