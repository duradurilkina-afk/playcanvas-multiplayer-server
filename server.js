const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

// Храним данные всех игроков
let players = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился! ID:', socket.id);

    // Добавляем базовые значения цвета (по умолчанию белый: 1, 1, 1)
    players[socket.id] = { x: 0, y: 0, z: 0, r: 1, g: 1, b: 1 };

    // Отправляем новичку список всех с их координатами и цветами
    socket.emit('currentPlayers', players);

    // Говорим всем остальным, что появился новый игрок
    socket.broadcast.emit('newPlayer', socket.id);

    // Когда игрок двигается ИЛИ меняет цвет
    socket.on('playerMoved', (positionData) => {
        players[socket.id] = positionData; // Обновляем у себя (там теперь есть x,y,z и r,g,b)

        // Пересылаем ВСЕМ остальным и координаты, и цвет!
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: positionData.x,
            y: positionData.y,
            z: positionData.z,
            r: positionData.r,
            g: positionData.g,
            b: positionData.b
        });
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Хостинг сам назначит порт через process.env.PORT. Если запускаем дома — включится 3000
const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});