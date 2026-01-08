/**
 * Wager Service
 * Handles placing and canceling wagers
 */

const roomService = require('./room');
const betService = require('./bet');

let wagerIdCounter = Date.now();

// Validate wager
function validateWager(player, bet, optionId, amount) {
    // Check bet status
    if (!bet || bet.status !== 'open') {
        return { valid: false, reason: '当前竞猜未开盘或已封盘' };
    }
    
    // Check amount
    if (!amount || amount <= 0) {
        return { valid: false, reason: '下注金额必须大于0' };
    }
    
    // Check player points
    if (amount > player.points) {
        return { valid: false, reason: `积分不足，当前积分: ${player.points}` };
    }
    
    // Check option exists
    const option = bet.options.find(o => o.id === optionId);
    if (!option) {
        return { valid: false, reason: '无效的选项' };
    }
    
    return { valid: true, option: option };
}

// Place a wager
function placeWager(room, playerId, betId, optionId, amount) {
    // Find the bet
    let bet = null;
    if (betId) {
        bet = betService.getBetById(room, betId);
    } else if (room.currentBets && room.currentBets.length > 0) {
        // Default to first bet if not specified
        bet = room.currentBets[0];
    } else {
        bet = room.currentBet;
    }
    
    if (!bet) {
        return { success: false, error: 'E006', message: '竞猜不存在' };
    }
    
    const player = room.players.find(p => p.id === playerId);
    
    if (!player) {
        return { success: false, error: 'E001', message: '玩家不存在' };
    }
    
    const validation = validateWager(player, bet, optionId, amount);
    if (!validation.valid) {
        return { success: false, error: 'E005', message: validation.reason };
    }
    
    const option = validation.option;
    
    // Deduct points
    player.points -= amount;
    player.lastActiveAt = new Date().toISOString();
    
    // Update option totals
    option.totalAmount += amount;
    option.wagerCount++;
    
    // Create wager record
    wagerIdCounter++;
    const wager = {
        id: wagerIdCounter,
        betId: bet.id,
        betTitle: bet.title,
        playerId: playerId,
        playerName: player.name,
        optionId: optionId,
        optionName: option.name,
        amount: amount,
        odds: option.odds,
        createdAt: new Date().toISOString(),
        payout: null,
        profit: null
    };
    
    bet.wagers.push(wager);
    
    // Update room stats
    room.stats.totalWagered += amount;
    
    roomService.updateRoom(room);
    
    return {
        success: true,
        wager: wager,
        newBalance: player.points
    };
}

// Cancel a wager
function cancelWager(room, playerId, wagerId) {
    // Find the wager in any bet
    let bet = null;
    let wager = null;
    let wagerIndex = -1;
    
    for (const b of (room.currentBets || [])) {
        const idx = b.wagers.findIndex(w => w.id === wagerId && w.playerId === playerId);
        if (idx !== -1) {
            bet = b;
            wager = b.wagers[idx];
            wagerIndex = idx;
            break;
        }
    }
    
    if (!bet || !wager) {
        return { success: false, error: 'E001', message: '未找到下注记录' };
    }
    
    if (bet.status !== 'open') {
        return { success: false, error: 'E007', message: '竞猜未开盘或已封盘，无法取消下注' };
    }
    
    const player = room.players.find(p => p.id === playerId);
    const option = bet.options.find(o => o.id === wager.optionId);
    
    // Refund points
    player.points += wager.amount;
    
    // Update option totals
    if (option) {
        option.totalAmount -= wager.amount;
        option.wagerCount--;
    }
    
    // Remove wager
    bet.wagers.splice(wagerIndex, 1);
    
    // Update room stats
    room.stats.totalWagered -= wager.amount;
    
    roomService.updateRoom(room);
    
    return {
        success: true,
        newBalance: player.points
    };
}

// Get wagers for a player
function getPlayerWagers(room, playerId) {
    const wagers = [];
    for (const bet of (room.currentBets || [])) {
        const playerWagers = bet.wagers.filter(w => w.playerId === playerId);
        wagers.push(...playerWagers);
    }
    return wagers;
}

module.exports = {
    placeWager,
    cancelWager,
    getPlayerWagers,
    validateWager
};
