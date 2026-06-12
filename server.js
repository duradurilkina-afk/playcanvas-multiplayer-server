const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Разрешаем подключение с любых доменов (критично для PlayCanvas)
        methods: ["GET", "POST"]
    }
});

// Amvera автоматически выдает порт через переменную окружения, либо используем 3000 локально
const PORT = process.env.PORT || 3000;

// Список всех активных игроков на сервере
const players = {};

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);

    // 1. Создаем нового игрока в базе данных сервера
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 2,
        z: 0,
        color: [1, 1, 1] // Цвет по умолчанию (белый)
    };

    // Отправляем новому игроку список всех, кто уже зашел в игру до него
    socket.emit('currentPlayers', players);

    // Сообщаем всем остальным игрокам, что подключился новичок
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 2. СИНХРОНИЗАЦИЯ ДВИЖЕНИЯ
    socket.on('move', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;

            // Рассылаем новые координаты этого игрока всем остальным
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 3. СИНХРОНИЗАЦИЯ ЦВЕТА (Новая механика по ПКМ)
    socket.on('changeColor', (colorArray) => {
        if (players[socket.id]) {
            // Сохраняем актуальный цвет игрока на сервере 
            // (чтобы новые подключившиеся игроки сразу видели его цветным, а не белым)
            players[socket.id].color = colorArray;

            // Пересылаем этот цвет всем остальным экранам
            socket.broadcast.emit('playerColorChanged', {
                id: socket.id,
                color: colorArray
            });
        }
    });

    // 4. ОБРАБОТКА ОТКЛЮЧЕНИЯ ИГРОКА
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);

        // Удаляем его из памяти сервера
        delete players[socket.id];

        // Говорим всем убрать эту капсулу с экрана
        io.emit('playerDisconnected', socket.id);
    });
});

// Запуск сервера
http.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});