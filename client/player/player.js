/**
 * Player Client Logic
 */

let roomState = null;
let myPlayer = null;
let selectedBetOption = null; // { betId, optionId }
let myCurrentWagers = {}; // betId -> wager

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for room code in URL
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'player' && pathParts[2]) {
        document.getElementById('roomCodeInput').value = pathParts[2].toUpperCase();
    }
    
    // Load saved player name
    const savedName = getLocal('playerName');
    if (savedName) {
        document.getElementById('playerName').value = savedName;
    }
    
    // Enter key support
    document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });
    document.getElementById('playerName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });
});

// Join room
async function joinRoom() {
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!roomCode || roomCode.length !== 6) {
        showToast('请输入6位房间码', 'error');
        return;
    }
    
    if (!playerName) {
        showToast('请输入你的昵称', 'error');
        return;
    }
    
    // Save player name
    storeLocal('playerName', playerName);
    
    try {
        await socketClient.connect();
        registerEventHandlers();
        socketClient.emit('player:join_room', { roomCode, playerName });
    } catch (error) {
        showToast('连接服务器失败', 'error');
        console.error('Connection failed:', error);
    }
}

// Register event handlers
function registerEventHandlers() {
    socketClient.on('self:joined', (data) => {
        myPlayer = data.player;
        roomState = data.roomState;
        showGameView();
        renderGame();
        addFeedItem(`你已加入房间`, 'system');
        showToast('加入成功！', 'success');
    });
    
    socketClient.on('self:rejoined', (data) => {
        myPlayer = data.player;
        roomState = data.roomState;
        showGameView();
        renderGame();
        addFeedItem(`重新连接成功`, 'system');
        showToast('重新连接成功！', 'success');
    });
    
    socketClient.on('room:player_joined', (data) => {
        if (data.player.id !== myPlayer?.id) {
            roomState.players.push(data.player);
            renderRanking();
            addFeedItem(`${data.player.name} 加入了房间`, 'system');
        }
    });
    
    socketClient.on('room:player_left', (data) => {
        roomState.players = roomState.players.filter(p => p.id !== data.playerId);
        renderRanking();
    });
    
    socketClient.on('room:player_reconnected', (data) => {
        const idx = roomState.players.findIndex(p => p.id === data.player.id);
        if (idx >= 0) {
            roomState.players[idx] = data.player;
        }
        if (data.player.id !== myPlayer?.id) {
            addFeedItem(`${data.player.name} 重新连接`, 'system');
        }
        renderRanking();
    });
    
    socketClient.on('room:bet_created', (data) => {
        roomState.currentBets = data.bets || [data.bet];
        roomState.currentBet = data.bet;
        roomState.bettingPhase = 'betting';
        roomState.currentRound = data.roundNumber;
        myCurrentWagers = {};
        selectedBetOption = null;
        renderBetting();
        const betCount = roomState.currentBets.length;
        addFeedItem(`第 ${data.roundNumber} 轮竞猜开始 (${betCount}项)`, 'system');
    });
    
    socketClient.on('room:betting_opened', (data) => {
        if (roomState.currentBets) {
            roomState.currentBets.forEach(bet => bet.status = 'open');
            roomState.bettingPhase = 'betting';
            renderBetting();
        }
    });
    
    socketClient.on('room:betting_locked', (data) => {
        if (roomState.currentBets) {
            roomState.currentBets.forEach(bet => bet.status = 'locked');
            roomState.bettingPhase = 'locked';
            renderBetting();
            addFeedItem(`竞猜已封盘，等待结果...`, 'system');
        }
    });
    
    socketClient.on('room:wager_placed', (data) => {
        if (roomState.currentBets) {
            const bet = roomState.currentBets.find(b => b.id === data.wager.betId);
            if (bet) {
                const option = bet.options.find(o => o.name === data.wager.optionName);
                if (option) {
                    option.totalAmount = (option.totalAmount || 0) + data.wager.amount;
                    option.wagerCount = (option.wagerCount || 0) + 1;
                }
            }
            renderBetting();
            
            if (data.wager.playerName !== myPlayer?.name) {
                addFeedItem(`${data.wager.playerName} 押注「${data.wager.optionName}」${formatNumber(data.wager.amount)}分`, 'wager');
            }
        }
    });
    
    socketClient.on('self:wager_confirmed', (data) => {
        if (data.wager) {
            myCurrentWagers[data.wager.betId] = data.wager;
            myPlayer.points = data.newBalance;
            renderBetting();
            renderMyStats();
            updateHeader();
            addFeedItem(`你押注「${data.wager.betTitle} - ${data.wager.optionName}」${formatNumber(data.wager.amount)}分`, 'wager');
            showToast('下注成功！', 'success');
        }
    });
    
    socketClient.on('self:wager_rejected', (data) => {
        showToast(data.reason, 'error');
    });
    
    socketClient.on('self:settle_result', (data) => {
        myPlayer.points = data.newBalance;
        updateHeader();
        renderMyStats();
        showResult(data.result);
    });
    
    socketClient.on('room:bet_settled', (data) => {
        // Update the settled bet in currentBets
        if (roomState.currentBets) {
            const idx = roomState.currentBets.findIndex(b => b.id === data.bet.id);
            if (idx >= 0) {
                roomState.currentBets[idx] = data.bet;
            }
        }
        
        // Update player points from results
        data.results.forEach(r => {
            const player = roomState.players.find(p => p.id === r.playerId);
            if (player) {
                player.points = r.newPoints;
            }
        });
        
        // If all settled, clear
        if (data.allSettled) {
            roomState.currentBets = [];
            roomState.bettingPhase = 'idle';
        }
        
        renderBetting();
        renderRanking();
        addFeedItem(`${data.bet.title} 结算: ${data.bet.winningOptionName}`, 'result');
    });
    
    socketClient.on('room:round_ended', (data) => {
        myCurrentWagers = {};
        selectedBetOption = null;
        roomState.currentBets = [];
        roomState.bettingPhase = 'idle';
        renderBetting();
    });
    
    socketClient.on('room:closing', (data) => {
        showToast('庄家即将关闭房间...', 'info');
    });
    
    socketClient.on('room:closed', (data) => {
        showFinalView(data);
    });
    
    socketClient.on('self:kicked', (data) => {
        showToast(data.reason, 'error');
        setTimeout(() => location.reload(), 2000);
    });
    
    socketClient.on('error', (data) => {
        showToast(data.message, 'error');
    });
    
    socketClient.on('disconnected', () => {
        showToast('与服务器断开连接', 'error');
    });
}

// Show game view
function showGameView() {
    document.getElementById('joinView').style.display = 'none';
    document.getElementById('gameView').style.display = 'block';
}

// Render game
function renderGame() {
    updateHeader();
    renderBetting();
    renderMyStats();
    renderRanking();
}

// Update header
function updateHeader() {
    document.getElementById('displayRoomCode').textContent = roomState.code;
    document.getElementById('myPoints').textContent = formatNumber(myPlayer.points);
    
    // Find my rank
    const sorted = [...roomState.players].filter(p => p.status !== 'left').sort((a, b) => b.points - a.points);
    const myRank = sorted.findIndex(p => p.id === myPlayer.id) + 1;
    document.getElementById('myRankBadge').textContent = `排名: ${getRankMedal(myRank)} ${myRank}`;
}

// Render betting
function renderBetting() {
    const titleEl = document.getElementById('currentBetTitle');
    const statusEl = document.getElementById('bettingStatus');
    const contentEl = document.getElementById('bettingContent');
    
    const bets = roomState.currentBets || [];
    
    if (bets.length === 0) {
        titleEl.textContent = '🎯 等待竞猜开始';
        statusEl.textContent = '等待中';
        statusEl.className = 'status-badge status-idle';
        contentEl.innerHTML = `
            <div class="waiting-state">
                <div class="waiting-icon">⏳</div>
                <p>等待庄家创建下一轮竞猜...</p>
            </div>
        `;
        document.getElementById('myWagerCard').style.display = 'none';
        return;
    }
    
    const openBets = bets.filter(b => b.status === 'open');
    const lockedBets = bets.filter(b => b.status === 'locked');
    const settledBets = bets.filter(b => b.status === 'settled');
    
    titleEl.textContent = `🎯 第 ${roomState.currentRound} 轮竞猜 (${bets.length}项)`;
    
    if (openBets.length > 0) {
        statusEl.textContent = `接受下注 (${openBets.length}项)`;
        statusEl.className = 'status-badge status-open';
    } else if (lockedBets.length > 0) {
        statusEl.textContent = `等待结算 (${lockedBets.length}项)`;
        statusEl.className = 'status-badge status-locked';
    } else {
        statusEl.textContent = '已结算';
        statusEl.className = 'status-badge status-idle';
    }
    
    // Render all bets
    contentEl.innerHTML = bets.map(bet => renderSingleBet(bet)).join('');
    
    renderMyWagers();
}

// Render a single bet
function renderSingleBet(bet) {
    const myWager = myCurrentWagers[bet.id];
    const isSelected = selectedBetOption && selectedBetOption.betId === bet.id;
    
    let betHTML = `
        <div class="bet-section" style="margin-bottom: 20px; padding: 16px; background: var(--bg-tertiary); border-radius: 12px; ${bet.status === 'settled' ? 'opacity: 0.6;' : ''}">
            <div class="bet-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600;">${escapeHtml(bet.title)}</span>
                <span class="status-badge status-${bet.status === 'open' ? 'open' : bet.status === 'locked' ? 'locked' : 'idle'}">
                    ${bet.status === 'open' ? '下注中' : bet.status === 'locked' ? '等待结算' : bet.winningOptionName || '已结算'}
                </span>
            </div>
    `;
    
    if (bet.status === 'open' && !myWager) {
        // Can bet
        betHTML += `
            <div class="betting-options" data-bet-id="${bet.id}">
                ${bet.options.map(opt => {
                    const isOptSelected = isSelected && selectedBetOption.optionId === opt.id;
                    return `
                        <div class="betting-option ${isOptSelected ? 'selected' : ''}" 
                             onclick="selectBetOption(${bet.id}, ${opt.id})" 
                             data-bet-id="${bet.id}" data-option-id="${opt.id}">
                            <div class="option-name">${escapeHtml(opt.name)}</div>
                            <div class="option-odds">×${opt.odds}</div>
                            <div class="option-stats">${formatNumber(opt.totalAmount || 0)}分 (${opt.wagerCount || 0}人)</div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="amount-section" id="amountSection-${bet.id}" style="${isSelected ? '' : 'display: none;'}">
                <label class="amount-label">下注积分 (当前: ${formatNumber(myPlayer.points)}分)</label>
                <div class="amount-input-wrapper">
                    <input type="number" id="wagerAmount-${bet.id}" class="form-input" placeholder="输入积分" min="1" max="${myPlayer.points}" oninput="updateExpectedPayoutFor(${bet.id})">
                </div>
                <div class="quick-amounts">
                    <button class="quick-amount-btn" onclick="setAmountFor(${bet.id}, 100)">100</button>
                    <button class="quick-amount-btn" onclick="setAmountFor(${bet.id}, 200)">200</button>
                    <button class="quick-amount-btn" onclick="setAmountFor(${bet.id}, 500)">500</button>
                    <button class="quick-amount-btn" onclick="setAmountFor(${bet.id}, ${myPlayer.points})">全押</button>
                </div>
                <div class="expected-payout" id="expectedPayout-${bet.id}">选择金额查看预计收益</div>
                <button class="btn btn-success btn-lg btn-block" onclick="placeWagerFor(${bet.id})">✅ 确认下注</button>
            </div>
        `;
    } else if (myWager) {
        // Already bet on this
        betHTML += `
            <div class="my-wager-display" style="padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
                <div>✅ 已下注: <strong>${escapeHtml(myWager.optionName)}</strong></div>
                <div>金额: ${formatNumber(myWager.amount)}分 | 赔率: ×${myWager.odds}</div>
                ${bet.status === 'settled' ? `<div style="margin-top: 8px; color: ${bet.winningOptionId === myWager.optionId ? 'var(--accent-success)' : 'var(--accent-danger)'}">${bet.winningOptionId === myWager.optionId ? '🎉 中奖!' : '💔 未中奖'}</div>` : ''}
            </div>
        `;
    } else if (bet.status === 'locked') {
        // Locked, didn't bet
        betHTML += `
            <div class="locked-state" style="text-align: center; padding: 20px;">
                <div>🔒 已封盘</div>
                <div style="color: var(--text-muted); font-size: 0.9em;">你未参与此项竞猜</div>
            </div>
        `;
    } else if (bet.status === 'settled') {
        // Settled, show result
        betHTML += `
            <div style="text-align: center; padding: 12px;">
                <div>结果: <strong>${escapeHtml(bet.winningOptionName || '-')}</strong></div>
            </div>
        `;
    }
    
    betHTML += '</div>';
    return betHTML;
}

// Select bet option
function selectBetOption(betId, optionId) {
    if (myCurrentWagers[betId]) return;
    
    selectedBetOption = { betId, optionId };
    
    // Update UI for all betting options
    document.querySelectorAll('.betting-option').forEach(el => {
        const elBetId = parseInt(el.dataset.betId);
        const elOptId = parseInt(el.dataset.optionId);
        el.classList.toggle('selected', elBetId === betId && elOptId === optionId);
    });
    
    // Show amount section for this bet
    document.querySelectorAll('[id^="amountSection-"]').forEach(el => {
        el.style.display = 'none';
    });
    const amountSection = document.getElementById(`amountSection-${betId}`);
    if (amountSection) {
        amountSection.style.display = 'block';
        document.getElementById(`wagerAmount-${betId}`).focus();
    }
    updateExpectedPayoutFor(betId);
}

// Set amount for specific bet
function setAmountFor(betId, amount) {
    document.getElementById(`wagerAmount-${betId}`).value = amount;
    updateExpectedPayoutFor(betId);
}

// Update expected payout for specific bet
function updateExpectedPayoutFor(betId) {
    const amount = parseInt(document.getElementById(`wagerAmount-${betId}`)?.value) || 0;
    const payoutEl = document.getElementById(`expectedPayout-${betId}`);
    if (!payoutEl || !selectedBetOption || selectedBetOption.betId !== betId) return;
    
    const bets = roomState.currentBets || [];
    const bet = bets.find(b => b.id === betId);
    if (!bet) return;
    
    const option = bet.options.find(o => o.id === selectedBetOption.optionId);
    if (!option || amount <= 0) {
        payoutEl.textContent = '选择金额查看预计收益';
        return;
    }
    
    const expectedPayout = Math.floor(amount * option.odds);
    const profit = expectedPayout - amount;
    payoutEl.innerHTML = `预计收益: <strong style="color: var(--accent-success)">+${formatNumber(profit)}分</strong> (返还 ${formatNumber(expectedPayout)}分)`;
}

// Place wager for specific bet
function placeWagerFor(betId) {
    if (!selectedBetOption || selectedBetOption.betId !== betId) {
        showToast('请先选择一个选项', 'error');
        return;
    }
    
    const amount = parseInt(document.getElementById(`wagerAmount-${betId}`)?.value) || 0;
    if (amount <= 0) {
        showToast('请输入下注金额', 'error');
        return;
    }
    
    if (amount > myPlayer.points) {
        showToast('积分不足', 'error');
        return;
    }
    
    socketClient.emit('player:place_wager', {
        betId: betId,
        optionId: selectedBetOption.optionId,
        amount: amount
    });
    
    // Reset selection for this bet
    selectedBetOption = null;
}

// Legacy functions for compatibility
function selectOption(optionId) {
    // For single bet compatibility
    const bets = roomState.currentBets || [];
    if (bets.length === 1) {
        selectBetOption(bets[0].id, optionId);
    }
}

function setAmount(amount) {
    if (selectedBetOption) {
        setAmountFor(selectedBetOption.betId, amount);
    }
}

function updateExpectedPayout() {
    // Legacy - now handled by updateExpectedPayoutFor
    if (selectedBetOption) {
        updateExpectedPayoutFor(selectedBetOption.betId);
    }
}

// Place wager (legacy, routes to new function)
function placeWager() {
    if (!selectedBetOption) {
        showToast('请先选择一个选项', 'error');
        return;
    }
    placeWagerFor(selectedBetOption.betId);
}

// Render my wagers (multiple bets)
function renderMyWagers() {
    const card = document.getElementById('myWagerCard');
    const info = document.getElementById('myWagerInfo');
    
    const wagers = Object.values(myCurrentWagers);
    
    if (wagers.length === 0) {
        card.style.display = 'none';
        return;
    }
    
    card.style.display = 'block';
    
    info.innerHTML = wagers.map(wager => {
        const potentialPayout = Math.floor(wager.amount * wager.odds);
        const potentialProfit = potentialPayout - wager.amount;
        return `
            <div class="my-wager-display" style="margin-bottom: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                <div class="wager-bet-title" style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 4px;">${escapeHtml(wager.betTitle || '')}</div>
                <div class="wager-option">「${escapeHtml(wager.optionName)}」×${wager.odds}</div>
                <div class="wager-amount">${formatNumber(wager.amount)}分</div>
                <div class="wager-potential" style="font-size: 0.9em; color: var(--text-secondary);">
                    若胜: <span style="color: var(--accent-success)">+${formatNumber(potentialProfit)}分</span>
                </div>
            </div>
        `;
    }).join('');
}

// Legacy function
function renderMyWager() {
    renderMyWagers();
}

// Render my stats
function renderMyStats() {
    document.getElementById('statPoints').textContent = formatNumber(myPlayer.points);
    
    const profit = myPlayer.points - myPlayer.initialPoints;
    const profitEl = document.getElementById('statProfit');
    profitEl.textContent = `${profit >= 0 ? '+' : ''}${formatNumber(profit)}`;
    profitEl.className = profit > 0 ? 'positive' : profit < 0 ? 'negative' : '';
    
    document.getElementById('statRounds').textContent = myPlayer.stats?.roundsPlayed || 0;
    document.getElementById('statWinRate').textContent = `${Math.round((myPlayer.stats?.winRate || 0) * 100)}%`;
}

// Render ranking
function renderRanking() {
    const container = document.getElementById('rankingList');
    const players = roomState.players.filter(p => p.status !== 'left');
    
    if (players.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无排名数据</p></div>';
        return;
    }
    
    const sorted = [...players].sort((a, b) => b.points - a.points);
    
    container.innerHTML = sorted.map((player, idx) => {
        const rank = idx + 1;
        const isMe = player.id === myPlayer.id;
        const profit = player.points - player.initialPoints;
        
        return `
            <div class="ranking-item ${isMe ? 'me' : ''}">
                <span class="ranking-rank">${getRankMedal(rank)} ${rank}</span>
                <span class="ranking-name">${escapeHtml(player.name)}${isMe ? ' (我)' : ''}</span>
                <span class="ranking-points">${formatNumber(player.points)}</span>
            </div>
        `;
    }).join('');
}

// Add feed item
function addFeedItem(message, type = 'system') {
    const feed = document.getElementById('liveFeed');
    
    // Remove empty state
    const empty = feed.querySelector('.feed-empty');
    if (empty) empty.remove();
    
    const item = document.createElement('div');
    item.className = `feed-item ${type}`;
    item.textContent = message;
    feed.insertBefore(item, feed.firstChild);
    
    // Keep only last 20 items
    while (feed.children.length > 20) {
        feed.removeChild(feed.lastChild);
    }
}

// Show result
function showResult(result) {
    document.getElementById('gameView').style.display = 'none';
    document.getElementById('resultView').style.display = 'block';
    
    const isWin = result.won;
    const content = document.getElementById('resultContent');
    
    content.innerHTML = `
        <div class="result-header ${isWin ? 'win' : 'lose'}">
            ${isWin ? '🎉 恭喜你猜对了！' : '😢 很遗憾，未能猜中'}
        </div>
        <div class="result-details">
            <div class="result-bet-title">第 ${roomState.currentRound} 轮竞猜</div>
            <div class="result-winning">正确结果: ${escapeHtml(result.optionName === roomState.history[0]?.winningOptionName ? result.optionName : roomState.history[0]?.winningOptionName || '')}</div>
            <div class="result-profit ${result.profit >= 0 ? 'positive' : 'negative'}">
                ${result.profit >= 0 ? '+' : ''}${formatNumber(result.profit)}分
            </div>
        </div>
        <p style="margin-bottom: 16px;">当前积分: <strong>${formatNumber(result.newPoints)}</strong> | 当前排名: ${getRankMedal(result.newRank)} 第${result.newRank}名</p>
    `;
}

// Dismiss result
function dismissResult() {
    document.getElementById('resultView').style.display = 'none';
    document.getElementById('gameView').style.display = 'block';
    renderGame();
}

// Show final view
function showFinalView(data) {
    document.getElementById('gameView').style.display = 'none';
    document.getElementById('resultView').style.display = 'none';
    document.getElementById('finalView').style.display = 'block';
    
    // Find my result
    const myResult = data.finalRanking.find(r => r.playerId === myPlayer.id);
    
    const resultEl = document.getElementById('finalResult');
    resultEl.innerHTML = `
        <div class="final-rank">${getRankMedal(myResult?.rank || 0)}</div>
        <div class="final-rank-text">你的最终排名: 第 ${myResult?.rank || '-'} 名</div>
        <div class="final-stats-grid">
            <div class="final-stat">
                <div class="final-stat-value">${formatNumber(myResult?.points || 0)}</div>
                <div class="final-stat-label">最终积分</div>
            </div>
            <div class="final-stat">
                <div class="final-stat-value ${(myResult?.netProfit || 0) >= 0 ? 'positive' : 'negative'}">
                    ${(myResult?.netProfit || 0) >= 0 ? '+' : ''}${formatNumber(myResult?.netProfit || 0)}
                </div>
                <div class="final-stat-label">总盈亏</div>
            </div>
            <div class="final-stat">
                <div class="final-stat-value">${myResult?.winRate || 0}%</div>
                <div class="final-stat-label">胜率</div>
            </div>
        </div>
    `;
    
    // Render final ranking
    const table = document.getElementById('finalRankingTable');
    table.innerHTML = `
        <thead>
            <tr>
                <th>排名</th>
                <th>玩家</th>
                <th>积分</th>
                <th>盈亏</th>
            </tr>
        </thead>
        <tbody>
            ${data.finalRanking.map(r => {
                const isMe = r.playerId === myPlayer.id;
                return `
                    <tr style="${isMe ? 'background: rgba(99, 102, 241, 0.15);' : ''}">
                        <td>${getRankMedal(r.rank)} ${r.rank}</td>
                        <td>${escapeHtml(r.playerName)}${isMe ? ' (我)' : ''}</td>
                        <td><strong>${formatNumber(r.points)}</strong></td>
                        <td class="${r.netProfit >= 0 ? 'positive' : 'negative'}">
                            ${r.netProfit >= 0 ? '+' : ''}${formatNumber(r.netProfit)}
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
}
