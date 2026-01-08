/**
 * Bet Service
 * Handles bet creation, opening, and locking
 */

const roomService = require('./room');
const presets = require('../data/presets');

let betIdCounter = Date.now();

// Create multiple bets for the room
function createBet(room, stageId, betConfigs) {
    if (room.bettingPhase !== 'idle') {
        return { success: false, error: 'E006', message: '当前有竞猜进行中' };
    }
    
    const stage = presets.getStage(stageId);
    if (!stage) {
        return { success: false, error: 'E008', message: '无效的关卡' };
    }
    
    // Initialize currentBets array if needed
    if (!room.currentBets) {
        room.currentBets = [];
    }
    room.currentBets = [];
    
    // Build bets from configs
    if (betConfigs && betConfigs.length > 0) {
        betConfigs.forEach((config, configIndex) => {
            betIdCounter++;
            
            const options = config.options.map((opt, idx) => ({
                id: idx + 1,
                name: opt.name,
                odds: opt.odds,
                totalAmount: 0,
                wagerCount: 0
            }));
            
            const bet = {
                id: betIdCounter,
                stageId: stageId,
                stageName: stage.name,
                title: config.title || `竞猜${configIndex + 1}`,
                fullTitle: `${stage.name} - ${config.title || `竞猜${configIndex + 1}`}`,
                options: options,
                wagers: [],
                status: 'open',
                createdAt: new Date().toISOString(),
                lockedAt: null,
                settledAt: null,
                winningOptionId: null
            };
            
            room.currentBets.push(bet);
        });
    } else {
        // Use all preset bets for the stage
        stage.bets.forEach((presetBet, configIndex) => {
            betIdCounter++;
            
            const options = presetBet.options.map((opt, idx) => ({
                id: idx + 1,
                name: opt.name,
                odds: opt.odds,
                totalAmount: 0,
                wagerCount: 0
            }));
            
            const bet = {
                id: betIdCounter,
                stageId: stageId,
                stageName: stage.name,
                title: presetBet.title,
                fullTitle: `${stage.name} - ${presetBet.title}`,
                options: options,
                wagers: [],
                status: 'open',
                createdAt: new Date().toISOString(),
                lockedAt: null,
                settledAt: null,
                winningOptionId: null
            };
            
            room.currentBets.push(bet);
        });
    }
    
    if (room.currentBets.length === 0) {
        return { success: false, error: 'E008', message: '没有可用的竞猜选项' };
    }
    
    room.currentRound++;
    room.bettingPhase = 'betting';
    
    // Keep currentBet as first bet for backward compatibility
    room.currentBet = room.currentBets[0];
    
    roomService.updateRoom(room);
    
    return { success: true, bets: room.currentBets, bet: room.currentBets[0] };
}

// Open betting
function openBetting(room) {
    if (!room.currentBets || room.currentBets.length === 0) {
        return { success: false, error: 'E006', message: '没有待开盘的竞猜' };
    }
    
    room.currentBets.forEach(bet => {
        if (bet.status === 'created') {
            bet.status = 'open';
        }
    });
    room.bettingPhase = 'betting';
    
    roomService.updateRoom(room);
    
    return { success: true };
}

// Lock betting
function lockBetting(room) {
    if (!room.currentBets || room.currentBets.length === 0) {
        return { success: false, error: 'E006', message: '没有进行中的竞猜' };
    }
    
    const now = new Date().toISOString();
    room.currentBets.forEach(bet => {
        if (bet.status === 'open') {
            bet.status = 'locked';
            bet.lockedAt = now;
        }
    });
    room.bettingPhase = 'locked';
    
    // Update currentBet for compatibility
    if (room.currentBet) {
        room.currentBet.status = 'locked';
        room.currentBet.lockedAt = now;
    }
    
    roomService.updateRoom(room);
    
    return { success: true };
}

// Get bet by ID
function getBetById(room, betId) {
    if (!room.currentBets) return null;
    return room.currentBets.find(b => b.id === betId);
}

// Get current bets
function getCurrentBets(room) {
    return room.currentBets || [];
}

// Get bet option by ID
function getBetOption(bet, optionId) {
    return bet.options.find(o => o.id === optionId);
}

module.exports = {
    createBet,
    openBetting,
    lockBetting,
    getCurrentBets,
    getBetById,
    getBetOption
};
