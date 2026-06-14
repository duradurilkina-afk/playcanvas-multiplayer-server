const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // Разрешаем подключения со всех доменов
});

const PORT = process.env.PORT || 80;

io.on('connection', (socket) => {
    console.log('Игрок подключился. ID:', socket.id);

    // 1. Сообщаем ВСЕМ, что зашел новый игрок
    socket.broadcast.emit('playerJoined', {
        id: socket.id,
        position: { x: 0, y: 0, z: 0 }
    });

    // 2. Обработка отключения
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});