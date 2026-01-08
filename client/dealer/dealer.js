/**
 * Dealer Client Logic
 */

let roomState = null;
let stages = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load presets
    try {
        const response = await fetch('/api/presets');
        stages = await response.json();
    } catch (error) {
        console.error('Failed to load presets:', error);
    }
});

// Create room
async function createRoom() {
    const dealerName = document.getElementById('dealerName').value.trim() || '庄家';
    const btn = document.querySelector('#createRoomView .btn');
    
    // Disable button to prevent double-click
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> 连接中...';
    }
    
    try {
        console.log('Connecting to server...');
        await socketClient.connect();
        console.log('Connected, registering handlers...');
        
        // Register event handlers
        registerEventHandlers();
        
        console.log('Emitting create_room event...');
        // Create room
        const success = socketClient.emit('dealer:create_room', { dealerName });
        
        if (!success) {
            throw new Error('Failed to emit create_room event');
        }
        
        console.log('Waiting for room creation...');
        
    } catch (error) {
        showToast('连接服务器失败: ' + error.message, 'error');
        console.error('Connection failed:', error);
        
        // Re-enable button
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🚀 创建房间';
        }
    }
}

// Register socket event handlers
function registerEventHandlers() {
    socketClient.on('dealer:room_created', (data) => {
        roomState = data.room;
        showRoomView();
        renderRoom();
        showToast('房间创建成功！', 'success');
    });
    
    socketClient.on('room:player_joined', (data) => {
        const player = data.player;
        roomState.players.push(player);
        renderPlayers();
        showToast(`${player.name} 加入了房间`, 'info');
    });
    
    socketClient.on('room:player_left', (data) => {
        roomState.players = roomState.players.filter(p => p.id !== data.playerId);
        renderPlayers();
    });
    
    socketClient.on('room:player_reconnected', (data) => {
        const idx = roomState.players.findIndex(p => p.id === data.player.id);
        if (idx >= 0) {
            roomState.players[idx] = data.player;
        }
        renderPlayers();
        showToast(`${data.player.name} 重新连接`, 'info');
    });
    
    socketClient.on('room:player_offline', (data) => {
        const player = roomState.players.find(p => p.id === data.playerId);
        if (player) {
            player.status = 'offline';
            renderPlayers();
        }
    });
    
    socketClient.on('room:bet_created', (data) => {
        roomState.currentBets = data.bets || [data.bet];
        roomState.currentBet = data.bet;
        roomState.bettingPhase = 'betting';
        roomState.currentRound = data.roundNumber;
        renderCurrentBets();
        closeModal('createBetModal');
    });
    
    socketClient.on('room:betting_locked', (data) => {
        if (roomState.currentBets) {
            roomState.currentBets.forEach(bet => bet.status = 'locked');
            roomState.bettingPhase = 'locked';
            renderCurrentBets();
        }
    });
    
    socketClient.on('room:wager_placed', (data) => {
        if (roomState.currentBets) {
            // Find the bet and update option totals
            const bet = roomState.currentBets.find(b => b.id === data.wager.betId);
            if (bet) {
                const option = bet.options.find(o => o.name === data.wager.optionName);
                if (option) {
                    option.totalAmount += data.wager.amount;
                    option.wagerCount = (option.wagerCount || 0) + 1;
                }
                if (!bet.wagers) bet.wagers = [];
                bet.wagers.push(data.wager);
            }
            
            renderWagerMonitor();
            addWagerToFeed(data.wager);
        }
    });
    
    socketClient.on('room:bet_settled', (data) => {
        // Update the settled bet in currentBets
        if (roomState.currentBets) {
            const idx = roomState.currentBets.findIndex(b => b.id === data.bet.id);
            if (idx >= 0) {
                roomState.currentBets[idx] = data.bet;
            }
        }
        
        // Update player points
        data.results.forEach(result => {
            const player = roomState.players.find(p => p.id === result.playerId);
            if (player) {
                player.points = result.newPoints;
            }
        });
        
        renderCurrentBets();
        renderPlayers();
        closeModal('settleModal');
        showSettleResult(data);
        
        // If all bets settled, clear for next round
        if (data.allSettled) {
            roomState.currentBets = [];
            roomState.currentBet = null;
            roomState.bettingPhase = 'idle';
            renderCurrentBets();
        }
    });
    
    socketClient.on('room:round_ended', (data) => {
        roomState.currentBets = [];
        roomState.currentBet = null;
        roomState.bettingPhase = 'idle';
        renderCurrentBets();
    });
    
    socketClient.on('room:closed', (data) => {
        showFinalView(data);
    });
    
    socketClient.on('error', (data) => {
        showToast(data.message, 'error');
    });
    
    socketClient.on('disconnected', () => {
        showToast('与服务器断开连接', 'error');
    });
}

// Show room view
function showRoomView() {
    document.getElementById('createRoomView').style.display = 'none';
    document.getElementById('roomView').style.display = 'block';
}

// Render room
function renderRoom() {
    document.getElementById('roomCode').textContent = roomState.code;
    document.getElementById('roomStatus').textContent = getStatusText(roomState.status);
    document.getElementById('roundNumber').textContent = roomState.currentRound;
    
    renderPlayers();
    renderCurrentBets();
    populateStageSelect();
}

// Render players
function renderPlayers() {
    const container = document.getElementById('playerList');
    const onlinePlayers = roomState.players.filter(p => p.status !== 'left');
    
    document.getElementById('playerCount').textContent = `${onlinePlayers.filter(p => p.status === 'online').length} 人在线`;
    
    if (onlinePlayers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👤</div>
                <p>等待玩家加入...</p>
                <p style="margin-top: 8px; font-size: 0.9rem;">房间码: <strong>${roomState.code}</strong></p>
            </div>
        `;
        return;
    }
    
    // Sort by points
    const sorted = [...onlinePlayers].sort((a, b) => b.points - a.points);
    
    container.innerHTML = sorted.map((player, idx) => {
        const profit = player.points - player.initialPoints;
        const profitClass = profit > 0 ? 'positive' : profit < 0 ? 'negative' : '';
        const rank = idx + 1;
        
        return `
            <div class="player-card">
                <div class="player-status ${player.status}"></div>
                <div class="player-rank">${getRankMedal(rank)}</div>
                <div class="player-name">${escapeHtml(player.name)}</div>
                <div class="player-points">${formatNumber(player.points)}分</div>
                <div class="player-profit ${profitClass}">
                    ${profit >= 0 ? '+' : ''}${formatNumber(profit)}
                </div>
            </div>
        `;
    }).join('');
}

// Populate stage select
function populateStageSelect() {
    const select = document.getElementById('stageSelect');
    select.innerHTML = stages.map(s => 
        `<option value="${s.id}">${s.name} (${s.difficulty})</option>`
    ).join('');
    
    updatePresetBets();
}

// Update preset bets based on selected stage
function updatePresetBets() {
    const stageId = parseInt(document.getElementById('stageSelect').value);
    const stage = stages.find(s => s.id === stageId);
    
    if (!stage) return;
    
    const container = document.getElementById('presetBetsContainer');
    container.innerHTML = stage.bets.map((bet, index) => `
        <label class="preset-bet-item">
            <input type="checkbox" name="presetBet" value="${index}" ${index === 0 ? 'checked' : ''}>
            <span class="preset-bet-title">${bet.title}</span>
            <div class="preset-bet-options">
                ${bet.options.map(o => `<span class="preset-option">${o.name} ×${o.odds}</span>`).join('')}
            </div>
        </label>
    `).join('');
}

// Select random bets
function selectRandomBet(count) {
    const checkboxes = document.querySelectorAll('input[name="presetBet"]');
    const total = checkboxes.length;
    const selectCount = Math.min(count, total);
    
    // Deselect all first
    checkboxes.forEach(cb => cb.checked = false);
    
    // Random select
    const indices = [];
    while (indices.length < selectCount) {
        const idx = Math.floor(Math.random() * total);
        if (!indices.includes(idx)) {
            indices.push(idx);
        }
    }
    
    indices.forEach(idx => checkboxes[idx].checked = true);
}

// Select all bets
function selectAllBets() {
    document.querySelectorAll('input[name="presetBet"]').forEach(cb => cb.checked = true);
}

// Create bet
function createBet() {
    const stageId = parseInt(document.getElementById('stageSelect').value);
    const stage = stages.find(s => s.id === stageId);
    
    const checkedBets = document.querySelectorAll('input[name="presetBet"]:checked');
    if (checkedBets.length === 0) {
        showToast('请至少选择一个竞猜', 'error');
        return;
    }
    
    // Collect all selected bets
    const bets = [];
    checkedBets.forEach(checkbox => {
        const betIndex = parseInt(checkbox.value);
        const presetBet = stage.bets[betIndex];
        if (presetBet) {
            bets.push({
                title: presetBet.title,
                options: presetBet.options
            });
        }
    });
    
    socketClient.emit('dealer:create_bet', {
        stageId: stageId,
        bets: bets
    });
}

// Render current bets (multiple)
function renderCurrentBets() {
    document.getElementById('roundNumber').textContent = roomState.currentRound;
    
    const statusBadge = document.getElementById('betPhaseStatus');
    const betInfo = document.getElementById('currentBetInfo');
    const monitorCard = document.getElementById('wagerMonitorCard');
    const controlCard = document.getElementById('betControlCard');
    const lockBtn = document.getElementById('lockBtn');
    const settleBtn = document.getElementById('settleBtn');
    
    const bets = roomState.currentBets || [];
    
    if (bets.length === 0) {
        statusBadge.textContent = '空闲';
        statusBadge.className = 'status-badge status-idle';
        betInfo.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>暂无进行中的竞猜</p>
                <button class="btn btn-success btn-lg" onclick="openModal('createBetModal')">
                    🎯 创建竞猜
                </button>
            </div>
        `;
        monitorCard.style.display = 'none';
        controlCard.style.display = 'none';
        return;
    }
    
    // Check status of bets
    const hasOpenBets = bets.some(b => b.status === 'open');
    const hasLockedBets = bets.some(b => b.status === 'locked');
    const hasUnsettledBets = bets.some(b => b.status !== 'settled');
    
    if (hasOpenBets) {
        statusBadge.textContent = `接受下注中 (${bets.length}项)`;
        statusBadge.className = 'status-badge status-open';
        lockBtn.style.display = 'inline-flex';
        settleBtn.style.display = 'none';
    } else if (hasLockedBets || hasUnsettledBets) {
        statusBadge.textContent = `已封盘 (${bets.filter(b => b.status !== 'settled').length}项待结算)`;
        statusBadge.className = 'status-badge status-locked';
        lockBtn.style.display = 'none';
        settleBtn.style.display = 'inline-flex';
    }
    
    // Show all bets
    betInfo.innerHTML = bets.map(bet => `
        <div class="current-bet-display" style="margin-bottom: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px; ${bet.status === 'settled' ? 'opacity: 0.6;' : ''}">
            <div class="current-bet-title" style="display: flex; justify-content: space-between; align-items: center;">
                <span>${escapeHtml(bet.title)}</span>
                <span class="status-badge status-${bet.status === 'open' ? 'open' : bet.status === 'locked' ? 'locked' : 'idle'}">${getStatusText(bet.status)}</span>
            </div>
            <div class="bet-options" style="margin-top: 12px;">
                ${bet.options.map(opt => `
                    <div class="bet-option-card" style="${bet.winningOptionId === opt.id ? 'border-color: var(--accent-success); background: rgba(16, 185, 129, 0.1);' : ''}">
                        <div class="bet-option-name">${opt.id === bet.winningOptionId ? '✅ ' : ''}${escapeHtml(opt.name)}</div>
                        <div class="bet-option-odds">×${opt.odds}</div>
                        <div class="bet-option-total">${formatNumber(opt.totalAmount || 0)}分 (${opt.wagerCount || 0}人)</div>
                    </div>
                `).join('')}
            </div>
            ${bet.status === 'locked' ? `<button class="btn btn-success btn-sm" style="margin-top: 12px;" onclick="openSettleModalForBet(${bet.id})">🏁 结算此项</button>` : ''}
        </div>
    `).join('');
    
    monitorCard.style.display = 'block';
    controlCard.style.display = hasUnsettledBets ? 'block' : 'none';
    
    renderWagerMonitor();
}

// Render wager monitor
function renderWagerMonitor() {
    const bets = roomState.currentBets || [];
    if (bets.length === 0) return;
    
    let totalWagered = 0;
    let wagerCount = 0;
    bets.forEach(bet => {
        bet.options.forEach(o => totalWagered += (o.totalAmount || 0));
        wagerCount += (bet.wagers?.length || 0);
    });
    
    const totalPlayers = roomState.players.filter(p => p.status === 'online').length;
    
    document.getElementById('wagerCount').textContent = `${wagerCount} 笔下注`;
    document.getElementById('totalPool').textContent = formatNumber(totalWagered);
    
    // Render distribution for all bets
    const container = document.getElementById('optionsDistribution');
    container.innerHTML = bets.filter(b => b.status !== 'settled').map(bet => {
        const betTotal = bet.options.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        return `
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">${escapeHtml(bet.title)}</div>
                ${bet.options.map(opt => {
                    const percentage = betTotal > 0 ? ((opt.totalAmount || 0) / betTotal * 100) : 0;
                    return `
                        <div class="option-bar">
                            <div class="option-bar-header">
                                <span class="option-bar-name">${escapeHtml(opt.name)} <span class="option-bar-odds">×${opt.odds}</span></span>
                                <span class="option-bar-amount">${formatNumber(opt.totalAmount || 0)}分 (${opt.wagerCount || 0}人)</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

// Add wager to feed
function addWagerToFeed(wager) {
    const feed = document.getElementById('wagerFeed');
    const item = document.createElement('div');
    item.className = 'wager-feed-item';
    item.innerHTML = `<strong>${escapeHtml(wager.playerName)}</strong> 押注「${escapeHtml(wager.optionName)}」${formatNumber(wager.amount)}分`;
    feed.insertBefore(item, feed.firstChild);
    
    // Keep only last 20 items
    while (feed.children.length > 20) {
        feed.removeChild(feed.lastChild);
    }
}

// Lock betting
function lockBetting() {
    if (!roomState.currentBet) return;
    socketClient.emit('dealer:lock_betting', { betId: roomState.currentBet.id });
}

// Current bet being settled
let currentSettlingBetId = null;

// Open settle modal for first unsettled bet
function openSettleModal() {
    const bets = roomState.currentBets || [];
    const unsettledBet = bets.find(b => b.status === 'locked');
    if (!unsettledBet) return;
    openSettleModalForBet(unsettledBet.id);
}

// Open settle modal for specific bet
function openSettleModalForBet(betId) {
    const bets = roomState.currentBets || [];
    const bet = bets.find(b => b.id === betId);
    if (!bet) return;
    
    currentSettlingBetId = betId;
    document.getElementById('settleBetTitle').textContent = bet.title;
    
    const container = document.getElementById('settleOptions');
    container.innerHTML = bet.options.map(opt => `
        <button class="settle-option" onclick="settleBet(${betId}, ${opt.id})">
            <div class="settle-option-name">🏆 ${escapeHtml(opt.name)}</div>
            <div class="settle-option-info">赔率 ×${opt.odds} | 下注: ${formatNumber(opt.totalAmount || 0)}分 (${opt.wagerCount || 0}人)</div>
        </button>
    `).join('');
    
    openModal('settleModal');
}

// Settle bet
function settleBet(betId, winningOptionId) {
    if (!confirm('确定选择此结果进行结算吗？')) return;
    
    socketClient.emit('dealer:settle_bet', {
        betId: betId,
        winningOptionId: winningOptionId
    });
}

// Show settle result
function showSettleResult(data) {
    const bet = data.bet;
    const results = data.results;
    
    const winners = results.filter(r => r.won);
    const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);
    
    let message = `🏁 第 ${roomState.currentRound} 轮结算完成！\n\n`;
    message += `竞猜: ${bet.title}\n`;
    message += `正确结果: ${bet.winningOptionName}\n\n`;
    
    if (winners.length > 0) {
        message += '🎉 中奖玩家:\n';
        winners.forEach(r => {
            message += `  ${r.playerName}: +${r.profit}分\n`;
        });
    }
    
    message += `\n总派奖: ${totalPayout}分`;
    
    showToast('结算完成！', 'success');
    
    // Clear wager feed
    document.getElementById('wagerFeed').innerHTML = '';
}

// Confirm close room
function confirmCloseRoom() {
    if (!confirm('确定要关闭房间吗？这将结束本场游戏并展示最终排名。')) return;
    
    socketClient.emit('dealer:close_room', { showFinalRanking: true });
}

// Show final view
function showFinalView(data) {
    document.getElementById('roomView').style.display = 'none';
    document.getElementById('finalView').style.display = 'block';
    
    // Render stats
    document.getElementById('finalStats').innerHTML = `
        <div class="final-stat">
            <div class="final-stat-value">${data.stats.totalRounds}</div>
            <div class="final-stat-label">总轮次</div>
        </div>
        <div class="final-stat">
            <div class="final-stat-value">${formatNumber(data.stats.totalWagered)}</div>
            <div class="final-stat-label">总下注</div>
        </div>
        <div class="final-stat">
            <div class="final-stat-value">${data.finalRanking.length}</div>
            <div class="final-stat-label">参与玩家</div>
        </div>
    `;
    
    // Render ranking
    const table = document.getElementById('finalRankingTable');
    table.innerHTML = `
        <thead>
            <tr>
                <th>排名</th>
                <th>玩家</th>
                <th>积分</th>
                <th>盈亏</th>
                <th>胜率</th>
            </tr>
        </thead>
        <tbody>
            ${data.finalRanking.map(r => `
                <tr>
                    <td>${getRankMedal(r.rank)} ${r.rank}</td>
                    <td>${escapeHtml(r.playerName)}</td>
                    <td><strong>${formatNumber(r.points)}</strong></td>
                    <td class="player-profit ${r.netProfit >= 0 ? 'positive' : 'negative'}">
                        ${r.netProfit >= 0 ? '+' : ''}${formatNumber(r.netProfit)}
                    </td>
                    <td>${r.winRate}%</td>
                </tr>
            `).join('')}
        </tbody>
    `;
}
