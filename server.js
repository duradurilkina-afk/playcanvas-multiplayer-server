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

const MAX_HP = 100;
const ATTACK_DAMAGE = 15;
const ATTACK_RANGE = 1.65;
const ATTACK_HALF_ANGLE_DEG = 70;
const ATTACK_COOLDOWN_MS = 450;
const HIT_HEIGHT_TOLERANCE = 1.8;

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

function copyVector(vector, fallback) {
    if (!validVector(vector)) {
        return fallback || { x: 0, y: 0, z: 0 };
    }

    return {
        x: vector.x,
        y: vector.y,
        z: vector.z
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function sanitizeNickname(value) {
    if (typeof value !== 'string') {
        return 'Player';
    }

    const nickname = value.trim();

    if (!nickname) {
        return 'Player';
    }

    return nickname.substring(0, 18);
}

function makePlayerState(socket, data) {
    return {
        id: socket.id,
        clientId: typeof data.clientId === 'string' ? data.clientId.substring(0, 64) : null,
        nickname: sanitizeNickname(data.nickname),
        position: copyVector(data.position),
        rotation: copyVector(data.rotation),
        modelRotation: copyVector(data.modelRotation),
        animState: isNumber(data.animState) ? Math.round(data.animState) : 0,
        hp: MAX_HP,
        maxHp: MAX_HP,
        lastAttackAt: 0
    };
}

function getPublicPlayer(player) {
    return {
        id: player.id,
        clientId: player.clientId,
        nickname: player.nickname,
        position: player.position,
        rotation: player.rotation,
        modelRotation: player.modelRotation,
        animState: player.animState,
        hp: player.hp,
        maxHp: player.maxHp
    };
}

function normalize2D(vector) {
    const length = Math.sqrt(vector.x * vector.x + vector.z * vector.z);

    if (length <= 0.0001) {
        return null;
    }

    return {
        x: vector.x / length,
        z: vector.z / length
    };
}

function getForwardFromYaw(yawDeg) {
    const yaw = yawDeg * Math.PI / 180;

    return normalize2D({
        x: -Math.sin(yaw),
        z: -Math.cos(yaw)
    }) || { x: 0, z: -1 };
}

function validAttackState(state) {
    return state === 8 || state === 9;
}

function findAttackHits(attacker, forward) {
    const hits = [];
    const minDot = Math.cos(ATTACK_HALF_ANGLE_DEG * Math.PI / 180);

    Object.keys(players).forEach((id) => {
        if (id === attacker.id) {
            return;
        }

        const target = players[id];

        if (!target || target.hp <= 0) {
            return;
        }

        const dx = target.position.x - attacker.position.x;
        const dz = target.position.z - attacker.position.z;
        const dy = Math.abs(target.position.y - attacker.position.y);
        const flatDistance = Math.sqrt(dx * dx + dz * dz);

        if (flatDistance > ATTACK_RANGE || dy > HIT_HEIGHT_TOLERANCE || flatDistance <= 0.001) {
            return;
        }

        const toTarget = {
            x: dx / flatDistance,
            z: dz / flatDistance
        };

        const dot = forward.x * toTarget.x + forward.z * toTarget.z;

        if (dot < minDot) {
            return;
        }

        hits.push(target);
    });

    return hits;
}

app.get('/', (request, response) => {
    response.json({
        status: 'ok',
        players: Object.keys(players).length
    });
});

io.on('connection', (socket) => {
    console.log('CONNECTED:', socket.id);

    socket.on('initPlayer', (data) => {
        if (!data || !validVector(data.position)) {
            console.warn('INVALID INIT:', socket.id, data);
            return;
        }

        players[socket.id] = makePlayerState(socket, data);

        const publicPlayers = {};

        Object.keys(players).forEach((id) => {
            publicPlayers[id] = getPublicPlayer(players[id]);
        });

        socket.emit('initAccepted', {
            id: socket.id,
            hp: players[socket.id].hp,
            maxHp: players[socket.id].maxHp
        });

        socket.emit('currentPlayers', publicPlayers);
        socket.broadcast.emit('playerJoined', getPublicPlayer(players[socket.id]));

        console.log('INITIALIZED:', socket.id, players[socket.id].nickname);
    });

    socket.on('playerState', (data) => {
        const player = players[socket.id];

        if (!player || !data || !validVector(data.position)) {
            return;
        }

        player.position = copyVector(data.position, player.position);
        player.rotation = copyVector(data.rotation, player.rotation);
        player.modelRotation = copyVector(data.modelRotation, player.modelRotation);

        if (isNumber(data.animState)) {
            player.animState = clamp(Math.round(data.animState), 0, 99);
        }

        socket.broadcast.emit('playerState', getPublicPlayer(player));
    });

    socket.on('attack', (data) => {
        const player = players[socket.id];

        if (!player || player.hp <= 0) {
            return;
        }

        const now = Date.now();

        if (now - player.lastAttackAt < ATTACK_COOLDOWN_MS) {
            return;
        }

        const attackState = data && isNumber(data.animState) ? Math.round(data.animState) : 8;

        if (!validAttackState(attackState)) {
            return;
        }

        player.lastAttackAt = now;
        player.animState = attackState;

        if (data && validVector(data.position)) {
            player.position = copyVector(data.position, player.position);
        }

        if (data && validVector(data.modelRotation)) {
            player.modelRotation = copyVector(data.modelRotation, player.modelRotation);
        }

        const forward = data && validVector(data.forward) ?
            normalize2D(data.forward) :
            getForwardFromYaw(player.modelRotation.y);

        const safeForward = forward || getForwardFromYaw(player.modelRotation.y);
        const hitPlayers = findAttackHits(player, safeForward);

        io.emit('attackStarted', {
            id: socket.id,
            animState: attackState,
            position: player.position,
            modelRotation: player.modelRotation,
            time: now
        });

        hitPlayers.forEach((target) => {
            target.hp = clamp(target.hp - ATTACK_DAMAGE, 0, target.maxHp);

            io.emit('playerDamaged', {
                attackerId: socket.id,
                targetId: target.id,
                damage: ATTACK_DAMAGE,
                hp: target.hp,
                maxHp: target.maxHp
            });

            console.log('HIT:', socket.id, '->', target.id, 'HP:', target.hp);
        });
    });

    socket.on('chatMessage', (data) => {
        if (!data || typeof data.text !== 'string') {
            return;
        }

        const text = data.text.trim();

        if (!text || text.length > 120) {
            return;
        }

        const player = players[socket.id];

        io.emit('chatMessage', {
            id: socket.id,
            clientId: player ? player.clientId : null,
            nickname: player ? player.nickname : 'Player',
            text: text,
            time: Date.now()
        });

        console.log('CHAT:', socket.id, text);
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
