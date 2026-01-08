/**
 * Socket.IO Event Router
 * Routes events to appropriate handlers
 */

const dealerHandler = require('./dealer');
const playerHandler = require('./player');

// Track socket connections
const socketToRoom = new Map(); // socketId -> { roomCode, playerId, role }

function initializeSocket(io) {
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        
        // Dealer events
        socket.on('dealer:create_room', (data) => {
            console.log('Received dealer:create_room event:', data);
            dealerHandler.handleCreateRoom(io, socket, data, socketToRoom);
        });
        
        socket.on('dealer:create_bet', (data) => {
            dealerHandler.handleCreateBet(io, socket, data, socketToRoom);
        });
        
        socket.on('dealer:open_betting', (data) => {
            dealerHandler.handleOpenBetting(io, socket, data, socketToRoom);
        });
        
        socket.on('dealer:lock_betting', (data) => {
            dealerHandler.handleLockBetting(io, socket, data, socketToRoom);
        });
        
        socket.on('dealer:settle_bet', (data) => {
            dealerHandler.handleSettleBet(io, socket, data, socketToRoom);
        });
        
        socket.on('dealer:close_room', (data) => {
            dealerHandler.handleCloseRoom(io, socket, data, socketToRoom);
        });
        
        socket.on('dealer:kick_player', (data) => {
            dealerHandler.handleKickPlayer(io, socket, data, socketToRoom);
        });
        
        // Player events
        socket.on('player:join_room', (data) => {
            playerHandler.handleJoinRoom(io, socket, data, socketToRoom);
        });
        
        socket.on('player:rejoin_room', (data) => {
            playerHandler.handleRejoinRoom(io, socket, data, socketToRoom);
        });
        
        socket.on('player:place_wager', (data) => {
            playerHandler.handlePlaceWager(io, socket, data, socketToRoom);
        });
        
        socket.on('player:cancel_wager', (data) => {
            playerHandler.handleCancelWager(io, socket, data, socketToRoom);
        });
        
        socket.on('player:leave_room', (data) => {
            playerHandler.handleLeaveRoom(io, socket, data, socketToRoom);
        });
        
        socket.on('player:get_stats', (data) => {
            playerHandler.handleGetStats(io, socket, data, socketToRoom);
        });
        
        // Disconnect
        socket.on('disconnect', () => {
            handleDisconnect(io, socket, socketToRoom);
        });
    });
}

function handleDisconnect(io, socket, socketToRoom) {
    console.log('Client disconnected:', socket.id);
    
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    
    const { roomCode, playerId, role } = info;
    
    if (role === 'player') {
        const roomService = require('../services/room');
        const player = roomService.setPlayerOffline(roomCode, playerId);
        
        if (player) {
            // Notify room about player going offline
            io.to(roomCode).emit('room:player_offline', { playerId: playerId });
        }
    }
    
    socketToRoom.delete(socket.id);
}

module.exports = { initializeSocket };
