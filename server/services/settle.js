/**
 * Settle Service
 * Handles bet settlement and payout calculation
 */

const roomService = require('./room');
const betService = require('./bet');

// Settle a single bet
function settleBet(room, betId, winningOptionId) {
    // Find the bet
    let bet = null;
    let betIndex = -1;
    
    if (room.currentBets && room.currentBets.length > 0) {
        betIndex = room.currentBets.findIndex(b => b.id === betId);
        if (betIndex !== -1) {
            bet = room.currentBets[betIndex];
        }
    }
    
    // Fallback to currentBet
    if (!bet && room.currentBet && room.currentBet.id === betId) {
        bet = room.currentBet;
    }
    
    if (!bet) {
        return { success: false, error: 'E006', message: '没有待结算的竞猜' };
    }
    
    if (bet.status !== 'locked' && bet.status !== 'open') {
        return { success: false, error: 'E006', message: '竞猜状态不允许结算' };
    }
    
    const winningOption = bet.options.find(o => o.id === winningOptionId);
    if (!winningOption) {
        return { success: false, error: 'E008', message: '无效的结果选项' };
    }
    
    // Calculate payouts
    const results = [];
    const playerWonMap = new Map();
    
    bet.wagers.forEach(wager => {
        const player = room.players.find(p => p.id === wager.playerId);
        if (!player) return;
        
        const won = wager.optionId === winningOptionId;
        let payout = 0;
        let profit = 0;
        
        if (won) {
            payout = Math.floor(wager.amount * wager.odds);
            profit = payout - wager.amount;
            player.points += payout;
            player.stats.totalWon += payout;
            playerWonMap.set(player.id, true);
        } else {
            payout = 0;
            profit = -wager.amount;
            player.stats.totalLost += wager.amount;
            if (!playerWonMap.has(player.id)) {
                playerWonMap.set(player.id, false);
            }
        }
        
        wager.payout = payout;
        wager.profit = profit;
        
        player.stats.totalWagered += wager.amount;
        player.stats.netProfit = player.points - player.initialPoints;
        
        results.push({
            playerId: player.id,
            playerName: player.name,
            betId: bet.id,
            betTitle: bet.title,
            optionId: wager.optionId,
            optionName: wager.optionName,
            amount: wager.amount,
            won: won,
            payout: payout,
            profit: profit,
            newPoints: player.points
        });
    });
    
    // Update player round stats
    playerWonMap.forEach((won, playerId) => {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.stats.roundsPlayed++;
            if (won) {
                player.stats.roundsWon++;
            }
            player.stats.winRate = player.stats.roundsPlayed > 0
                ? (player.stats.roundsWon / player.stats.roundsPlayed)
                : 0;
        }
    });
    
    // Calculate total payout
    const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);
    room.stats.totalPayout += totalPayout;
    
    // Finalize bet
    bet.status = 'settled';
    bet.settledAt = new Date().toISOString();
    bet.winningOptionId = winningOptionId;
    bet.winningOptionName = winningOption.name;
    bet.totalPayout = totalPayout;
    
    // Check if all bets are settled
    const allSettled = room.currentBets.every(b => b.status === 'settled');
    
    if (allSettled) {
        // Create history record
        const settledRound = {
            roundNumber: room.currentRound,
            bets: room.currentBets.map(b => ({
                id: b.id,
                stageId: b.stageId,
                stageName: b.stageName,
                title: b.title,
                options: b.options,
                winningOptionId: b.winningOptionId,
                winningOptionName: b.winningOptionName,
                totalWagered: b.options.reduce((sum, o) => sum + o.totalAmount, 0),
                totalPayout: b.totalPayout,
                settledAt: b.settledAt
            })),
            createdAt: room.currentBets[0]?.createdAt,
            settledAt: new Date().toISOString()
        };
        
        room.history.push(settledRound);
        if (room.history.length > 50) {
            room.history.shift();
        }
        
        room.stats.totalRounds++;
        
        // Reset for next round
        room.currentBets = [];
        room.currentBet = null;
        room.bettingPhase = 'idle';
    }
    
    // Add ranking to results
    const ranking = roomService.getPlayerRanking(room);
    results.forEach(result => {
        const rankInfo = ranking.find(r => r.playerId === result.playerId);
        result.newRank = rankInfo ? rankInfo.rank : 0;
    });
    
    roomService.updateRoom(room);
    
    return {
        success: true,
        settledBet: bet,
        results: results,
        ranking: ranking,
        allSettled: allSettled
    };
}

module.exports = {
    settleBet
};
