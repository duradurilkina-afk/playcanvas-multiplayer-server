const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

const io = new Server(http, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 80;
const players = {};

app.get('/', (req, res) => {
    res.send('PlayCanvas multiplayer server is running');
});

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    players[socket.id] = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        speed: 0
    };

    socket.on('initPosition', (data) => {
        if (!data || !data.position) return;

        players[socket.id] = {
            position: data.position,
            rotation: data.rotation || { x: 0, y: 0, z: 0 },
            speed: 0
        };

        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            ...players[socket.id]
        });
    });

    socket.on('playerMoved', (data) => {
        if (!data || !data.position) return;

        players[socket.id] = {
            position: data.position,
            rotation: data.rotation || players[socket.id].rotation,
            speed: Number.isFinite(data.speed) ? data.speed : 0
        };

        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            ...players[socket.id]
        });
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', socket.id);
    });
});

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
