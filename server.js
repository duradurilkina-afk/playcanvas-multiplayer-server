const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

const PORT = process.env.PORT || 80;

io.on('connection', (socket) => {
    console.log('Игрок подключился. ID:', socket.id);

    // ОПОВЕЩАЕМ ВСЕХ о новичке
    const data = { id: socket.id, position: { x: 0, y: 0, z: 0 } };
    socket.broadcast.emit('playerJoined', data);
    console.log('Сервер отправил broadcast playerJoined для:', socket.id);

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        socket.broadcast.emit('playerLeft', { id: socket.id });
    });
});

http.listen(PORT, () => {
    console.log('Сервер запущен на порту ' + PORT);
});