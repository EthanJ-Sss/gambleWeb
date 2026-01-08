/**
 * Player Socket Event Handlers
 */

const roomService = require('../services/room');
const wagerService = require('../services/wager');

// Join room
function handleJoinRoom(io, socket, data, socketToRoom) {
    const { roomCode, playerName } = data;
    
    if (!roomCode || !playerName) {
        socket.emit('error', { code: 'E000', message: '请输入房间码和昵称' });
        return;
    }
    
    const result = roomService.addPlayer(roomCode.toUpperCase(), playerName);
    
    if (!result.success) {
        socket.emit('error', { code: result.error, message: result.message });
        return;
    }
    
    // Join socket room
    socket.join(roomCode.toUpperCase());
    
    // Track socket
    socketToRoom.set(socket.id, {
        roomCode: roomCode.toUpperCase(),
        playerId: result.player.id,
        role: 'player'
    });
    
    // Send join confirmation
    socket.emit('self:joined', {
        player: result.player,
        roomState: roomService.getRoomState(result.room)
    });
    
    // Notify room about new player
    if (result.isReconnect) {
        io.to(roomCode.toUpperCase()).emit('room:player_reconnected', {
            player: result.player
        });
    } else {
        io.to(roomCode.toUpperCase()).emit('room:player_joined', {
            player: result.player
        });
    }
    
    console.log(`Player ${playerName} joined room ${roomCode}${result.isReconnect ? ' (reconnect)' : ''}`);
}

// Rejoin room (explicit reconnect)
function handleRejoinRoom(io, socket, data, socketToRoom) {
    const { roomCode, playerName, playerId } = data;
    
    const room = roomService.getRoom(roomCode.toUpperCase());
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    // Find player by ID or name
    let player = null;
    if (playerId) {
        player = room.players.find(p => p.id === playerId);
    }
    if (!player && playerName) {
        player = room.players.find(p => p.name === playerName && p.status !== 'left');
    }
    
    if (!player) {
        socket.emit('error', { code: 'E001', message: '未找到您的游戏记录' });
        return;
    }
    
    // Set player online
    roomService.setPlayerOnline(roomCode.toUpperCase(), player.id);
    
    // Join socket room
    socket.join(roomCode.toUpperCase());
    
    // Track socket
    socketToRoom.set(socket.id, {
        roomCode: roomCode.toUpperCase(),
        playerId: player.id,
        role: 'player'
    });
    
    // Send rejoin confirmation
    socket.emit('self:rejoined', {
        player: player,
        roomState: roomService.getRoomState(room),
        missedEvents: [] // Could be populated with recent events
    });
    
    // Notify room
    io.to(roomCode.toUpperCase()).emit('room:player_reconnected', {
        player: player
    });
    
    console.log(`Player ${player.name} rejoined room ${roomCode}`);
}

// Place wager
function handlePlaceWager(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'player') {
        socket.emit('error', { code: 'E009', message: '请先加入房间' });
        return;
    }
    
    const { betId, optionId, amount } = data;
    const room = roomService.getRoom(info.roomCode);
    
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const result = wagerService.placeWager(room, info.playerId, betId, optionId, amount);
    
    if (!result.success) {
        socket.emit('self:wager_rejected', { reason: result.message });
        return;
    }
    
    // Confirm to player
    socket.emit('self:wager_confirmed', {
        wager: result.wager,
        newBalance: result.newBalance
    });
    
    // Broadcast to room (public info only)
    io.to(room.code).emit('room:wager_placed', {
        wager: {
            id: result.wager.id,
            betId: result.wager.betId,
            betTitle: result.wager.betTitle,
            playerName: result.wager.playerName,
            optionName: result.wager.optionName,
            amount: result.wager.amount
        }
    });
    
    console.log(`Wager placed in room ${room.code}: ${result.wager.playerName} bet ${amount} on ${result.wager.optionName}`);
}

// Cancel wager
function handleCancelWager(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'player') {
        socket.emit('error', { code: 'E009', message: '请先加入房间' });
        return;
    }
    
    const { wagerId } = data;
    const room = roomService.getRoom(info.roomCode);
    
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const result = wagerService.cancelWager(room, info.playerId, wagerId);
    
    if (!result.success) {
        socket.emit('error', { code: result.error, message: result.message });
        return;
    }
    
    // Confirm to player
    socket.emit('self:wager_confirmed', {
        wager: null,
        newBalance: result.newBalance
    });
    
    // Broadcast cancellation
    io.to(room.code).emit('room:wager_cancelled', { wagerId: wagerId });
}

// Leave room
function handleLeaveRoom(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    
    const room = roomService.getRoom(info.roomCode);
    if (room && info.playerId) {
        roomService.removePlayer(info.roomCode, info.playerId);
        io.to(info.roomCode).emit('room:player_left', { playerId: info.playerId });
    }
    
    socket.leave(info.roomCode);
    socketToRoom.delete(socket.id);
}

// Get stats
function handleGetStats(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'player') return;
    
    const room = roomService.getRoom(info.roomCode);
    if (!room) return;
    
    const player = room.players.find(p => p.id === info.playerId);
    if (player) {
        socket.emit('self:stats_updated', { stats: player.stats });
    }
}

module.exports = {
    handleJoinRoom,
    handleRejoinRoom,
    handlePlaceWager,
    handleCancelWager,
    handleLeaveRoom,
    handleGetStats
};
