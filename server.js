const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Разрешаем доступ со всех доменов
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 80;

// Хранилище всех подключенных игроков
let players = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился. ID:', socket.id);

    // Добавляем игрока в список с начальной позицией
    players[socket.id] = { position: { x: 0, y: 0, z: 0 } };

    // 1. Отправляем только что подключившемуся игроку список всех существующих игроков
    socket.emit('currentPlayers', players);

    // 2. Оповещаем всех остальных участников, что появился новый игрок
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        position: { x: 0, y: 0, z: 0 }
    });

    // Обработка отключения игрока
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
        // Сообщаем всем остальным, что игрок ушел
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

// Запуск сервера
http.listen(PORT, () => {
    console.log('Сервер успешно запущен на порту ' + PORT);
});