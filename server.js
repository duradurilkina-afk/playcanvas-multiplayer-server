const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 80;

// Хранилище всех игроков
let players = {};

io.on('connection', (socket) => {
    console.log('Новое подключение. ID:', socket.id);

    // Защита: если ID вдруг совпал (редко при реконнекте), очищаем старые данные
    if (players[socket.id]) {
        console.log('Внимание: дубликат ID, перезаписываем:', socket.id);
    }

    // Инициализируем данные нового игрока
    players[socket.id] = { position: { x: 0, y: 0, z: 0 } };

    // 1. Отправляем только что зашедшему игроку список всех, кто уже в игре
    socket.emit('currentPlayers', players);

    // 2. Оповещаем всех остальных (кроме самого новичка) о том, что зашел новый игрок
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        position: { x: 0, y: 0, z: 0 }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        if (players[socket.id]) {
            delete players[socket.id];
            // Оповещаем остальных, что игрок вышел
            socket.broadcast.emit('playerLeft', { id: socket.id });
        }
    });
});

http.listen(PORT, () => {
    console.log('Сервер успешно запущен на порту ' + PORT);
});