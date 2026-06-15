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
const balls = {};

function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function validVector(vector) {
    return vector &&
        isNumber(vector.x) &&
        isNumber(vector.y) &&
        isNumber(vector.z);
}

function copyVector(vector) {
    return {
        x: vector.x,
        y: vector.y,
        z: vector.z
    };
}

function makePlayerState(data) {
    return {
        position: copyVector(data.position),
        rotation: validVector(data.rotation) ? copyVector(data.rotation) : {
            x: 0,
            y: 0,
            z: 0
        },
        speed: isNumber(data.speed) ? data.speed : 0
    };
}

function makeBallState(socket, data, state) {
    return {
        id: String(data.id),
        ownerId: socket.id,
        state: state,
        position: copyVector(data.position),
        rotation: validVector(data.rotation) ? copyVector(data.rotation) : {
            x: 0,
            y: 0,
            z: 0
        },
        impulse: validVector(data.impulse) ? copyVector(data.impulse) : {
            x: 0,
            y: 0,
            z: 0
        }
    };
}

function validBallPacket(data) {
    return data &&
        typeof data.id === 'string' &&
        data.id.length > 0 &&
        validVector(data.position);
}

app.get('/', (request, response) => {
    response.json({
        status: 'ok',
        players: Object.keys(players).length,
        balls: Object.keys(balls).length
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
        socket.emit('currentBalls', balls);
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

        players[socket.id] = makePlayerState(data);

        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            ...players[socket.id]
        });
    });

    socket.on('ballSpawned', (data) => {
        if (!validBallPacket(data)) {
            console.warn('INVALID BALL SPAWN:', socket.id, data);
            return;
        }

        balls[data.id] = makeBallState(socket, data, 'held');
        socket.broadcast.emit('ballSpawned', balls[data.id]);
        console.log('BALL SPAWNED:', data.id, 'OWNER:', socket.id);
    });

    socket.on('ballHeld', (data) => {
        if (!validBallPacket(data)) return;

        if (!balls[data.id] || balls[data.id].ownerId !== socket.id) return;

        balls[data.id] = makeBallState(socket, data, 'held');
        socket.broadcast.emit('ballHeld', balls[data.id]);
    });

    socket.on('ballThrown', (data) => {
        if (!validBallPacket(data)) {
            console.warn('INVALID BALL THROW:', socket.id, data);
            return;
        }

        if (!balls[data.id] || balls[data.id].ownerId !== socket.id) return;

        balls[data.id] = makeBallState(socket, data, 'thrown');
        io.emit('ballThrown', balls[data.id]);
        console.log('BALL THROWN:', data.id, 'OWNER:', socket.id);
    });

    socket.on('ballDestroyed', (data) => {
        if (!data || typeof data.id !== 'string') return;

        if (balls[data.id] && balls[data.id].ownerId === socket.id) {
            delete balls[data.id];
            socket.broadcast.emit('ballDestroyed', { id: data.id });
            console.log('BALL DESTROYED:', data.id);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('DISCONNECTED:', socket.id, reason);

        delete players[socket.id];
        socket.broadcast.emit('playerLeft', socket.id);

        Object.keys(balls).forEach((ballId) => {
            if (balls[ballId].ownerId === socket.id) {
                delete balls[ballId];
                socket.broadcast.emit('ballDestroyed', { id: ballId });
            }
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('SERVER STARTED ON PORT:', PORT);
});
