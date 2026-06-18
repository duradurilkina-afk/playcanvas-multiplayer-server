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
const LEFT_HOOK_DAMAGE = 15;
const RIGHT_HOOK_DAMAGE = 25;
const ATTACK_RANGE = 0.95;
const ATTACK_HALF_ANGLE_DEG = 180;
const ATTACK_COOLDOWN_MS = 500;
const HIT_HEIGHT_TOLERANCE = 1.8;
const TARGET_HIT_RADIUS = 0.25;
const USE_ATTACK_CONE = false;
const CLIENT_TARGET_VALIDATION_RANGE = 1.55;

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

function getAttackDamage(state) {
    if (state === 9) {
        return RIGHT_HOOK_DAMAGE;
    }

    return LEFT_HOOK_DAMAGE;
}

function findAttackHits(attacker, forward, requestedTargetIds) {
    const hits = [];
    const misses = [];
    const minDot = Math.cos(ATTACK_HALF_ANGLE_DEG * Math.PI / 180);
    const effectiveRange = ATTACK_RANGE + TARGET_HIT_RADIUS;
    const hasRequestedTargets = Array.isArray(requestedTargetIds);
    const requestedTargetSet = new Set(hasRequestedTargets ? requestedTargetIds : []);

    Object.keys(players).forEach((id) => {
        if (id === attacker.id) {
            return;
        }

        if (hasRequestedTargets && !requestedTargetSet.has(id)) {
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

        if (dy > HIT_HEIGHT_TOLERANCE) {
            misses.push({
                id: target.id,
                reason: 'height',
                distance: flatDistance,
                height: dy,
                dot: 0
            });
            return;
        }

        const maxDistance = hasRequestedTargets ? CLIENT_TARGET_VALIDATION_RANGE : effectiveRange;

        if (flatDistance > maxDistance) {
            misses.push({
                id: target.id,
                reason: 'range',
                distance: flatDistance,
                height: dy,
                dot: 0
            });
            return;
        }

        if (flatDistance <= 0.001) {
            hits.push(target);
            return;
        }

        const toTarget = {
            x: dx / flatDistance,
            z: dz / flatDistance
        };

        const dot = forward.x * toTarget.x + forward.z * toTarget.z;

        if (USE_ATTACK_CONE && dot < minDot) {
            misses.push({
                id: target.id,
                reason: 'angle',
                distance: flatDistance,
                height: dy,
                dot: dot
            });
            return;
        }

        hits.push(target);
    });

    return {
        hits,
        misses
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
        const attackDamage = getAttackDamage(attackState);

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
        const requestedTargetIds = Array.isArray(data && data.targetIds) ?
            data.targetIds.filter((id) => typeof id === 'string').slice(0, 8) :
            null;

        const hitResult = findAttackHits(player, safeForward, requestedTargetIds);
        const hitPlayers = hitResult.hits;

        io.emit('attackStarted', {
            id: socket.id,
            animState: attackState,
            position: player.position,
            modelRotation: player.modelRotation,
            time: now
        });

        socket.emit('attackDebug', {
            attackState,
            damage: attackDamage,
            hitCount: hitPlayers.length,
            range: ATTACK_RANGE,
            targetRadius: TARGET_HIT_RADIUS,
            angle: ATTACK_HALF_ANGLE_DEG,
            useAttackCone: USE_ATTACK_CONE,
            attackerPosition: player.position,
            forward: safeForward,
            misses: hitResult.misses.map((miss) => ({
                id: miss.id,
                reason: miss.reason,
                distance: Number(miss.distance.toFixed(3)),
                height: Number(miss.height.toFixed(3)),
                dot: Number(miss.dot.toFixed(3))
            }))
        });

        console.log('ATTACK:', socket.id, 'hits:', hitPlayers.length, 'misses:', hitResult.misses.length);

        hitResult.misses.forEach((miss) => {
            console.log(
                'MISS:',
                socket.id,
                '->',
                miss.id,
                miss.reason,
                'distance:',
                miss.distance.toFixed(2),
                'height:',
                miss.height.toFixed(2),
                'dot:',
                miss.dot.toFixed(2)
            );
        });

        hitPlayers.forEach((target) => {
            target.hp = clamp(target.hp - attackDamage, 0, target.maxHp);

            io.emit('playerDamaged', {
                attackerId: socket.id,
                targetId: target.id,
                damage: attackDamage,
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
