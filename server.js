const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// ИСПРАВЛЕНИЕ CORS: Разрешаем PlayCanvas подключаться к нашему серверу
const io = new Server(server, {
    cors: {
        origin: "*", // Разрешает запросы со всех доменов
        methods: ["GET", "POST"]
    }
});

// Хранилище игроков
const players = {};

// Массив случайных цветов (RGB)
const randomColors = [
    [1, 0, 0],   // Красный
    [0, 1, 0],   // Зеленый
    [0, 0, 1],   // Синий
    [1, 1, 0],   // Желтый
    [1, 0, 1],   // Фиолетовый
    [0, 1, 1]    // Голубой
];

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);

    // Выбираем случайный цвет для нового игрока
    const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];

    // Создаем данные нового игрока
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 2,
        z: 0,
        color: randomColor
    };

    // 1. Отправляем новому игроку список всех, кто уже на сервере
    socket.emit('currentPlayers', players);

    // 2. Всем остальным сообщаем, что зашел новый игрок
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Обработка движения
    socket.on('move', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;

            // Рассылаем координаты всем остальным
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Обработка смены цвета (при клике ПКМ)
    socket.on('changeColor', (colorData) => {
        if (players[socket.id]) {
            players[socket.id].color = colorData;
            // Отправляем обновленный цвет ВСЕМ игрокам
            io.emit('playerColorChanged', {
                id: socket.id,
                color: colorData
            });
        }
    });

    // Отключение игрока
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        delete players[socket.id];
        // Сообщаем всем, что игрок вышел
        io.emit('playerDisconnected', socket.id);
    });
});

// ИСПРАВЛЕНИЕ ПОРТА: Переключаемся на порт 80 или динамический порт Amvera
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});