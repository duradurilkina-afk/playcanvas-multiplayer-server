const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 80;
const players = {};

function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function validVector(vector) {
    return vector &&
        isNumber(vector.x) &&
        isNumber(vector.y) &&
        isNumber(vector.z);
}

function makePlayerState(data) {
    return {
        position: {
            x: data.position.x,
            y: data.position.y,
            z: data.position.z
        },
        rotation: validVector(data.rotation) ? {
            x: data.rotation.x,
            y: data.rotation.y,
            z: data.rotation.z
        } : {
            x: 0,
            y: 0,
            z: 0
        },
        speed: isNumber(data.speed) ? data.speed : 0
    };
}

app.get('/', (request, response) => {
    response.json({
        status: 'ok',
        players: Object.keys(players).length
    });
});

io.on('connection', (socket) => {
    console.log('CONNECTED:', socket.id);

    socket.on('initPosition', (data) => {
        if (!data || !validVector(data.position)) {
            console.warn('INVALID INIT:', socket.id, data);
            return;
        }

        players[socket.id] = makePlayerState(data);

        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', {
            id: socket.id,
            ...players[socket.id]
        });

        console.log('INITIALIZED:', socket.id, players[socket.id].position);
    });

    socket.on('playerMoved', (data) => {
        if (!data || !validVector(data.position)) {
            console.warn('INVALID MOVE:', socket.id, data);
            return;
        }

        console.log('SERVER RECEIVED MOVEMENT:', socket.id, data.position);

        players[socket.id] = makePlayerState(data);

        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            ...players[socket.id]
        });
    });

    socket.on('disconnect', (reason) => {
        console.log('DISCONNECTED:', socket.id, reason);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('SERVER STARTED ON PORT:', PORT);
});