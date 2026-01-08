/**
 * Room Service
 * Handles room creation, player management, and room state
 */

const { v4: uuidv4 } = require('uuid');
const storage = require('../data/storage');

// In-memory cache of active rooms for faster access
const activeRooms = new Map();

// Generate a 6-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create a new room
function createRoom(dealerId, dealerName) {
    let code = generateRoomCode();
    
    // Ensure unique code
    while (activeRooms.has(code) || storage.getRoom(code)) {
        code = generateRoomCode();
    }
    
    const room = {
        id: uuidv4(),
        code: code,
        dealerId: dealerId,
        dealerName: dealerName,
        status: 'active',
        bettingPhase: 'idle', // idle, betting, locked, settling
        players: [],
        currentRound: 0,
        currentBet: null,
        history: [],
        stats: {
            totalRounds: 0,
            totalWagered: 0,
            totalPayout: 0,
            startTime: new Date().toISOString(),
            endTime: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    activeRooms.set(code, room);
    storage.saveRoom(room);
    
    return room;
}

// Get room by code
function getRoom(code) {
    if (activeRooms.has(code)) {
        return activeRooms.get(code);
    }
    
    const room = storage.getRoom(code);
    if (room && room.status === 'active') {
        activeRooms.set(code, room);
        return room;
    }
    
    return null;
}

// Update room
function updateRoom(room) {
    room.updatedAt = new Date().toISOString();
    activeRooms.set(room.code, room);
    storage.saveRoom(room);
}

// Create a new player
function createPlayer(name, initialPoints = 1000) {
    return {
        id: uuidv4(),
        name: name,
        points: initialPoints,
        initialPoints: initialPoints,
        status: 'online', // online, offline, left
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        stats: {
            roundsPlayed: 0,
            roundsWon: 0,
            totalWagered: 0,
            totalWon: 0,
            totalLost: 0,
            netProfit: 0,
            winRate: 0
        }
    };
}

// Add player to room
function addPlayer(roomCode, playerName) {
    const room = getRoom(roomCode);
    if (!room) {
        return { success: false, error: 'E001', message: '房间不存在' };
    }
    
    if (room.status !== 'active') {
        return { success: false, error: 'E003', message: '房间已关闭' };
    }
    
    // Check for duplicate name
    const existingPlayer = room.players.find(p => p.name === playerName && p.status !== 'left');
    if (existingPlayer) {
        // Allow reconnect for offline players
        if (existingPlayer.status === 'offline') {
            existingPlayer.status = 'online';
            existingPlayer.lastActiveAt = new Date().toISOString();
            updateRoom(room);
            return { success: true, player: existingPlayer, room: room, isReconnect: true };
        }
        return { success: false, error: 'E004', message: '昵称已被使用' };
    }
    
    const player = createPlayer(playerName);
    room.players.push(player);
    updateRoom(room);
    
    return { success: true, player: player, room: room, isReconnect: false };
}

// Set player offline
function setPlayerOffline(roomCode, playerId) {
    const room = getRoom(roomCode);
    if (!room) return null;
    
    const player = room.players.find(p => p.id === playerId);
    if (player) {
        player.status = 'offline';
        player.lastActiveAt = new Date().toISOString();
        updateRoom(room);
    }
    
    return player;
}

// Set player online
function setPlayerOnline(roomCode, playerId) {
    const room = getRoom(roomCode);
    if (!room) return null;
    
    const player = room.players.find(p => p.id === playerId);
    if (player) {
        player.status = 'online';
        player.lastActiveAt = new Date().toISOString();
        updateRoom(room);
    }
    
    return player;
}

// Remove player from room
function removePlayer(roomCode, playerId) {
    const room = getRoom(roomCode);
    if (!room) return null;
    
    const player = room.players.find(p => p.id === playerId);
    if (player) {
        player.status = 'left';
        updateRoom(room);
    }
    
    return player;
}

// Close room
function closeRoom(roomCode) {
    const room = getRoom(roomCode);
    if (!room) return null;
    
    room.status = 'closed';
    room.stats.endTime = new Date().toISOString();
    updateRoom(room);
    
    activeRooms.delete(roomCode);
    
    return room;
}

// Get player ranking
function getPlayerRanking(room) {
    const activePlayers = room.players.filter(p => p.status !== 'left');
    
    return activePlayers
        .sort((a, b) => b.points - a.points)
        .map((player, index) => ({
            rank: index + 1,
            playerId: player.id,
            playerName: player.name,
            points: player.points,
            initialPoints: player.initialPoints,
            netProfit: player.points - player.initialPoints,
            profitRate: ((player.points - player.initialPoints) / player.initialPoints * 100).toFixed(1),
            roundsPlayed: player.stats.roundsPlayed,
            winRate: player.stats.roundsPlayed > 0 
                ? ((player.stats.roundsWon / player.stats.roundsPlayed) * 100).toFixed(0)
                : 0
        }));
}

// Get room state for client sync
function getRoomState(room) {
    return {
        code: room.code,
        status: room.status,
        bettingPhase: room.bettingPhase,
        currentRound: room.currentRound,
        currentBet: room.currentBet,
        currentBets: room.currentBets || [],
        players: room.players.filter(p => p.status !== 'left').map(p => ({
            id: p.id,
            name: p.name,
            points: p.points,
            status: p.status,
            stats: p.stats
        })),
        ranking: getPlayerRanking(room),
        history: room.history.slice(-5),
        stats: room.stats
    };
}

module.exports = {
    createRoom,
    getRoom,
    updateRoom,
    createPlayer,
    addPlayer,
    setPlayerOffline,
    setPlayerOnline,
    removePlayer,
    closeRoom,
    getPlayerRanking,
    getRoomState
};


