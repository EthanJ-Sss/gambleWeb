/**
 * Dealer Socket Event Handlers
 */

const roomService = require('../services/room');
const betService = require('../services/bet');
const settleService = require('../services/settle');

// Create a new room
function handleCreateRoom(io, socket, data, socketToRoom) {
    const { dealerName } = data;
    
    if (!dealerName) {
        socket.emit('error', { code: 'E000', message: '请输入庄家名称' });
        return;
    }
    
    const room = roomService.createRoom(socket.id, dealerName);
    
    // Join socket room
    socket.join(room.code);
    
    // Track socket
    socketToRoom.set(socket.id, {
        roomCode: room.code,
        playerId: null,
        role: 'dealer'
    });
    
    socket.emit('dealer:room_created', {
        room: roomService.getRoomState(room)
    });
    
    console.log(`Room created: ${room.code} by ${dealerName}`);
}

// Create a new bet (new round)
function handleCreateBet(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'dealer') {
        socket.emit('error', { code: 'E009', message: '权限不足' });
        return;
    }
    
    const { stageId, bets } = data;
    const room = roomService.getRoom(info.roomCode);
    
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const result = betService.createBet(room, stageId, bets);
    
    if (!result.success) {
        socket.emit('error', { code: result.error, message: result.message });
        return;
    }
    
    // Broadcast to all in room
    io.to(room.code).emit('room:round_started', { roundNumber: room.currentRound });
    io.to(room.code).emit('room:bet_created', { 
        bets: result.bets,
        bet: result.bet,  // Keep for backward compatibility
        roundNumber: room.currentRound 
    });
    
    console.log(`${result.bets.length} bet(s) created in room ${room.code}`);
}

// Open betting
function handleOpenBetting(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'dealer') {
        socket.emit('error', { code: 'E009', message: '权限不足' });
        return;
    }
    
    const room = roomService.getRoom(info.roomCode);
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const result = betService.openBetting(room);
    
    if (!result.success) {
        socket.emit('error', { code: result.error, message: result.message });
        return;
    }
    
    io.to(room.code).emit('room:betting_opened', { betId: room.currentBet.id });
    
    console.log(`Betting opened in room ${room.code}`);
}

// Lock betting
function handleLockBetting(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'dealer') {
        socket.emit('error', { code: 'E009', message: '权限不足' });
        return;
    }
    
    const room = roomService.getRoom(info.roomCode);
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const result = betService.lockBetting(room);
    
    if (!result.success) {
        socket.emit('error', { code: result.error, message: result.message });
        return;
    }
    
    io.to(room.code).emit('room:betting_locked', { betId: room.currentBet.id });
    
    console.log(`Betting locked in room ${room.code}`);
}

// Settle bet
function handleSettleBet(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'dealer') {
        socket.emit('error', { code: 'E009', message: '权限不足' });
        return;
    }
    
    const { betId, winningOptionId } = data;
    const room = roomService.getRoom(info.roomCode);
    
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const result = settleService.settleBet(room, betId, winningOptionId);
    
    if (!result.success) {
        socket.emit('error', { code: result.error, message: result.message });
        return;
    }
    
    // Broadcast settlement to all
    io.to(room.code).emit('room:bet_settled', {
        bet: result.settledBet,
        results: result.results,
        roundNumber: room.currentRound,
        allSettled: result.allSettled
    });
    
    // Send individual results to each player
    result.results.forEach(playerResult => {
        for (const [socketId, sockInfo] of socketToRoom.entries()) {
            if (sockInfo.playerId === playerResult.playerId) {
                io.to(socketId).emit('self:settle_result', {
                    result: playerResult,
                    newBalance: playerResult.newPoints
                });
                break;
            }
        }
    });
    
    // Notify round ended only when all bets are settled
    if (result.allSettled) {
        io.to(room.code).emit('room:round_ended', {
            roundNumber: room.currentRound,
            nextRoundReady: true
        });
    }
    
    console.log(`Bet ${betId} settled in room ${room.code}, winner: option ${winningOptionId}`);
}

// Close room
function handleCloseRoom(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'dealer') {
        socket.emit('error', { code: 'E009', message: '权限不足' });
        return;
    }
    
    const room = roomService.getRoom(info.roomCode);
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const finalRanking = roomService.getPlayerRanking(room);
    
    // Notify closing
    io.to(room.code).emit('room:closing', { finalRanking });
    
    // Close room
    const closedRoom = roomService.closeRoom(room.code);
    
    // Final notification
    io.to(room.code).emit('room:closed', {
        stats: closedRoom.stats,
        finalRanking: finalRanking
    });
    
    console.log(`Room closed: ${room.code}`);
}

// Kick player
function handleKickPlayer(io, socket, data, socketToRoom) {
    const info = socketToRoom.get(socket.id);
    if (!info || info.role !== 'dealer') {
        socket.emit('error', { code: 'E009', message: '权限不足' });
        return;
    }
    
    const { playerId } = data;
    const room = roomService.getRoom(info.roomCode);
    
    if (!room) {
        socket.emit('error', { code: 'E001', message: '房间不存在' });
        return;
    }
    
    const player = roomService.removePlayer(room.code, playerId);
    
    if (player) {
        // Notify the kicked player
        for (const [socketId, sockInfo] of socketToRoom.entries()) {
            if (sockInfo.playerId === playerId) {
                io.to(socketId).emit('self:kicked', { reason: '你已被庄家移出房间' });
                break;
            }
        }
        
        // Notify room
        io.to(room.code).emit('room:player_left', { playerId: playerId });
    }
}

module.exports = {
    handleCreateRoom,
    handleCreateBet,
    handleOpenBetting,
    handleLockBetting,
    handleSettleBet,
    handleCloseRoom,
    handleKickPlayer
};
