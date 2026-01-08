/**
 * 🎮 对战竞猜平台 - 核心逻辑
 * 使用 LocalStorage 存储数据
 * 竞猜预设从 BettingPresets.csv 加载
 */

// ===== 关卡与预设竞猜数据（从CSV加载） =====
let STAGES = [];
let stagesLoaded = false;

// 解析CSV文件
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        if (values.length >= 4) {
            const row = {};
            headers.forEach((header, idx) => {
                row[header.trim()] = values[idx] || '';
            });
            data.push(row);
        }
    }
    return data;
}

// 从CSV构建STAGES数据
function buildStagesFromCSV(csvData) {
    const stagesMap = new Map();
    
    csvData.forEach(row => {
        const stageId = parseInt(row['关卡ID']);
        const stageName = row['关卡名称'];
        const difficulty = row['难度定位'];
        const betTitle = row['竞猜标题'];
        
        if (!stageId || !stageName || !betTitle) return;
        
        // 获取或创建关卡
        if (!stagesMap.has(stageId)) {
            stagesMap.set(stageId, {
                id: stageId,
                name: `第${stageId}关 - ${stageName}`,
                boss: stageName,
                difficulty: difficulty,
                bets: []
            });
        }
        
        const stage = stagesMap.get(stageId);
        
        // 构建选项
        const options = [];
        for (let i = 1; i <= 5; i++) {
            const optName = row[`选项${i}`];
            const optOdds = parseFloat(row[`赔率${i}`]);
            if (optName && !isNaN(optOdds)) {
                options.push({ name: optName, odds: optOdds });
            }
        }
        
        if (options.length > 0) {
            stage.bets.push({ title: betTitle, options: options });
        }
    });
    
    // 转换为数组并排序
    return Array.from(stagesMap.values()).sort((a, b) => a.id - b.id);
}

// 加载CSV文件
async function loadBettingPresets() {
    try {
        const response = await fetch('BettingPresets.csv');
        if (!response.ok) {
            throw new Error('Failed to load BettingPresets.csv');
        }
        const csvText = await response.text();
        const csvData = parseCSV(csvText);
        STAGES = buildStagesFromCSV(csvData);
        stagesLoaded = true;
        console.log('Loaded', STAGES.length, 'stages from CSV');
        return true;
    } catch (error) {
        console.error('Error loading CSV:', error);
        // 使用默认数据作为后备
        STAGES = getDefaultStages();
        stagesLoaded = true;
        return false;
    }
}

// 默认数据（后备）
function getDefaultStages() {
    return [
        { id: 1, name: '第1关 - 白菜人', boss: '白菜人', difficulty: '新手教学', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 1.15 }, { name: '玩家失败', odds: 5.0 }] }
        ]},
        { id: 2, name: '第2关 - 霸王龙', boss: '霸王龙', difficulty: '机动性考验', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 1.35 }, { name: '玩家失败', odds: 3.0 }] }
        ]},
        { id: 3, name: '第3关 - 地狱男爵', boss: '地狱男爵', difficulty: 'DOT规避', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 1.50 }, { name: '玩家失败', odds: 2.5 }] }
        ]},
        { id: 4, name: '第4关 - 洛基', boss: '洛基', difficulty: '控制抵抗', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 1.70 }, { name: '玩家失败', odds: 2.2 }] }
        ]},
        { id: 5, name: '第5关 - 假面骑士', boss: '假面骑士', difficulty: '爆发输出', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 1.85 }, { name: '玩家失败', odds: 2.0 }] }
        ]},
        { id: 6, name: '第6关 - 擎天柱', boss: '擎天柱', difficulty: 'AOE清场', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 2.00 }, { name: '玩家失败', odds: 1.85 }] }
        ]},
        { id: 7, name: '第7关 - 春丽', boss: '春丽', difficulty: '生存防御', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 2.20 }, { name: '玩家失败', odds: 1.70 }] }
        ]},
        { id: 8, name: '第8关 - 春野樱', boss: '春野樱', difficulty: '持续DPS', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 2.50 }, { name: '玩家失败', odds: 1.55 }] }
        ]},
        { id: 9, name: '第9关 - 电锯惊魂', boss: '电锯惊魂', difficulty: '移动闪避', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 3.00 }, { name: '玩家失败', odds: 1.40 }] }
        ]},
        { id: 10, name: '第10关 - 埃及艳后', boss: '埃及艳后', difficulty: '综合考验', bets: [
            { title: '胜负', options: [{ name: '玩家胜利', odds: 4.00 }, { name: '玩家失败', odds: 1.25 }] }
        ]}
    ];
}

// ===== 数据存储键名 =====
const STORAGE_KEYS = {
    USERS: 'gamble_users',
    ACTIVE_BETS: 'gamble_active_bets',
    WAGERS: 'gamble_wagers',
    HISTORY: 'gamble_history',
    CURRENT_STAGE: 'gamble_current_stage',
    DUELS: 'gamble_duels',
    DUEL_HISTORY: 'gamble_duel_history'
};

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    // 先加载CSV数据
    await loadBettingPresets();
    initApp();
});

function initApp() {
    renderLeaderboard();
    renderUsersList();
    renderActiveBets();
    renderDuels();
    renderHistory();
    
    // 显示加载状态
    if (stagesLoaded) {
        console.log('关卡数据加载完成，共', STAGES.length, '关');
    }
}

// ===== 数据操作 =====
function getUsers() {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getActiveBets() {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_BETS);
    return data ? JSON.parse(data) : [];
}

function saveActiveBets(bets) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BETS, JSON.stringify(bets));
}

function getWagers() {
    const data = localStorage.getItem(STORAGE_KEYS.WAGERS);
    return data ? JSON.parse(data) : [];
}

function saveWagers(wagers) {
    localStorage.setItem(STORAGE_KEYS.WAGERS, JSON.stringify(wagers));
}

function getHistory() {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
}

function saveHistory(history) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

function getCurrentStage() {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_STAGE);
    return data ? parseInt(data) : 1;
}

function saveCurrentStage(stageId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_STAGE, stageId.toString());
}

function getDuels() {
    const data = localStorage.getItem(STORAGE_KEYS.DUELS);
    return data ? JSON.parse(data) : [];
}

function saveDuels(duels) {
    localStorage.setItem(STORAGE_KEYS.DUELS, JSON.stringify(duels));
}

function getDuelHistory() {
    const data = localStorage.getItem(STORAGE_KEYS.DUEL_HISTORY);
    return data ? JSON.parse(data) : [];
}

function saveDuelHistory(history) {
    localStorage.setItem(STORAGE_KEYS.DUEL_HISTORY, JSON.stringify(history));
}

// ===== 用户管理 =====
function showAddUserModal() {
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserPoints').value = '1000';
    openModal('addUserModal');
}

function addUser(event) {
    event.preventDefault();
    
    const name = document.getElementById('newUserName').value.trim();
    const points = parseInt(document.getElementById('newUserPoints').value) || 1000;
    
    if (!name) {
        alert('请输入用户名');
        return;
    }
    
    const users = getUsers();
    
    if (users.some(u => u.name === name)) {
        alert('用户名已存在');
        return;
    }
    
    users.push({
        id: Date.now(),
        name: name,
        points: points,
        initialPoints: points
    });
    
    saveUsers(users);
    closeModal('addUserModal');
    renderLeaderboard();
    renderUsersList();
    updateAllWagerUserSelects();
}

function deleteUser(userId) {
    if (!confirm('确定要删除该用户吗？')) return;
    
    let users = getUsers();
    users = users.filter(u => u.id !== userId);
    saveUsers(users);
    
    let wagers = getWagers();
    wagers = wagers.filter(w => w.userId !== userId);
    saveWagers(wagers);
    
    renderLeaderboard();
    renderUsersList();
    renderActiveBets();
    updateAllWagerUserSelects();
}

function resetAllPoints() {
    if (!confirm('确定要重置所有用户的积分为1000吗？')) return;
    
    const users = getUsers();
    users.forEach(u => {
        u.points = 1000;
        u.initialPoints = 1000;
    });
    saveUsers(users);
    
    renderLeaderboard();
    renderUsersList();
    alert('所有用户积分已重置为1000');
}

// ===== 竞猜管理 =====
function showCreateBetModal() {
    const currentStage = getCurrentStage();
    
    // 渲染关卡选择
    const stageSelect = document.getElementById('stageSelect');
    stageSelect.innerHTML = STAGES.map(s => 
        `<option value="${s.id}" ${s.id === currentStage ? 'selected' : ''}>${s.name} (${s.difficulty})</option>`
    ).join('');
    
    // 渲染预设竞猜
    updatePresetBets();
    
    // 清空自定义表单
    document.getElementById('customBetTitle').value = '';
    resetCustomOptions();
    
    openModal('createBetModal');
}

function updatePresetBets() {
    const stageId = parseInt(document.getElementById('stageSelect').value);
    const stage = STAGES.find(s => s.id === stageId);
    
    if (!stage) return;
    
    saveCurrentStage(stageId);
    
    const container = document.getElementById('presetBetsContainer');
    container.innerHTML = stage.bets.map((bet, index) => `
        <div class="preset-bet-item">
            <label class="preset-bet-checkbox">
                <input type="checkbox" name="presetBet" value="${index}" checked>
                <span class="preset-bet-title">${bet.title}</span>
            </label>
            <div class="preset-bet-options">
                ${bet.options.map(o => `<span class="preset-option">${o.name} ×${o.odds}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

function randomSelectBet() {
    const stageId = parseInt(document.getElementById('stageSelect').value);
    const stage = STAGES.find(s => s.id === stageId);
    
    if (!stage || stage.bets.length === 0) return;
    
    // 随机选择一个
    const randomIndex = Math.floor(Math.random() * stage.bets.length);
    
    // 取消所有选择，只选中随机的那个
    const checkboxes = document.querySelectorAll('input[name="presetBet"]');
    checkboxes.forEach((cb, idx) => {
        cb.checked = (idx === randomIndex);
    });
}

function randomSelectThreeBets() {
    const stageId = parseInt(document.getElementById('stageSelect').value);
    const stage = STAGES.find(s => s.id === stageId);
    
    if (!stage || stage.bets.length === 0) return;
    
    const checkboxes = document.querySelectorAll('input[name="presetBet"]');
    const totalBets = stage.bets.length;
    const selectCount = Math.min(3, totalBets); // 最多选3个，如果不足3个则全选
    
    // 生成不重复的随机索引
    const indices = [];
    while (indices.length < selectCount) {
        const randomIndex = Math.floor(Math.random() * totalBets);
        if (!indices.includes(randomIndex)) {
            indices.push(randomIndex);
        }
    }
    
    // 取消所有选择，只选中随机的那几个
    checkboxes.forEach((cb, idx) => {
        cb.checked = indices.includes(idx);
    });
}

function selectAllBets() {
    const checkboxes = document.querySelectorAll('input[name="presetBet"]');
    checkboxes.forEach(cb => cb.checked = true);
}

function deselectAllBets() {
    const checkboxes = document.querySelectorAll('input[name="presetBet"]');
    checkboxes.forEach(cb => cb.checked = false);
}

function resetCustomOptions() {
    const container = document.getElementById('customOptionsContainer');
    container.innerHTML = `
        <div class="option-row">
            <input type="text" placeholder="选项名称" class="option-name">
            <input type="number" step="0.01" min="1" placeholder="赔率" class="option-odds">
            <button type="button" class="btn btn-danger btn-small" onclick="removeOption(this)">✕</button>
        </div>
        <div class="option-row">
            <input type="text" placeholder="选项名称" class="option-name">
            <input type="number" step="0.01" min="1" placeholder="赔率" class="option-odds">
            <button type="button" class="btn btn-danger btn-small" onclick="removeOption(this)">✕</button>
        </div>
    `;
}

function addOption() {
    const container = document.getElementById('customOptionsContainer');
    const row = document.createElement('div');
    row.className = 'option-row';
    row.innerHTML = `
        <input type="text" placeholder="选项名称" class="option-name">
        <input type="number" step="0.01" min="1" placeholder="赔率" class="option-odds">
        <button type="button" class="btn btn-danger btn-small" onclick="removeOption(this)">✕</button>
    `;
    container.appendChild(row);
}

function removeOption(btn) {
    const rows = document.querySelectorAll('#customOptionsContainer .option-row');
    if (rows.length <= 2) {
        alert('至少需要保留2个选项');
        return;
    }
    btn.parentElement.remove();
}

function createBets(event) {
    event.preventDefault();
    
    const stageId = parseInt(document.getElementById('stageSelect').value);
    const stage = STAGES.find(s => s.id === stageId);
    
    const activeBets = getActiveBets();
    const newBets = [];
    
    // 处理预设竞猜
    const checkedPresets = document.querySelectorAll('input[name="presetBet"]:checked');
    checkedPresets.forEach(cb => {
        const betIndex = parseInt(cb.value);
        const presetBet = stage.bets[betIndex];
        
        newBets.push({
            id: Math.floor(Date.now() + Math.random() * 1000),
            stageId: stageId,
            stageName: stage.name,
            title: `${stage.name} - ${presetBet.title}`,
            options: presetBet.options.map((o, i) => ({
                id: i + 1,
                name: o.name,
                odds: o.odds,
                totalAmount: 0
            })),
            status: 'open',
            createdAt: new Date().toISOString()
        });
    });
    
    // 处理自定义竞猜
    const customTitle = document.getElementById('customBetTitle').value.trim();
    if (customTitle) {
        const optionNames = document.querySelectorAll('#customOptionsContainer .option-name');
        const optionOdds = document.querySelectorAll('#customOptionsContainer .option-odds');
        
        const customOptions = [];
        for (let i = 0; i < optionNames.length; i++) {
            const name = optionNames[i].value.trim();
            const odds = parseFloat(optionOdds[i].value);
            
            if (name && odds && odds >= 1) {
                customOptions.push({
                    id: i + 1,
                    name: name,
                    odds: odds,
                    totalAmount: 0
                });
            }
        }
        
        if (customOptions.length >= 2) {
            newBets.push({
                id: Math.floor(Date.now() + Math.random() * 1000),
                stageId: stageId,
                stageName: stage.name,
                title: `${stage.name} - ${customTitle}`,
                options: customOptions,
                status: 'open',
                createdAt: new Date().toISOString()
            });
        }
    }
    
    if (newBets.length === 0) {
        alert('请至少选择一个预设竞猜或填写完整的自定义竞猜');
        return;
    }
    
    // 添加到活跃竞猜
    activeBets.push(...newBets);
    saveActiveBets(activeBets);
    
    closeModal('createBetModal');
    renderActiveBets();
    
    alert(`成功创建 ${newBets.length} 个竞猜！`);
}

function cancelBet(betId) {
    if (!confirm('确定要取消此竞猜吗？所有下注将被退还。')) return;
    
    let activeBets = getActiveBets();
    const bet = activeBets.find(b => b.id === betId);
    
    if (!bet) return;
    
    // 退还下注
    const wagers = getWagers();
    const users = getUsers();
    
    wagers.filter(w => w.betId === betId).forEach(wager => {
        const user = users.find(u => u.id === wager.userId);
        if (user) {
            user.points += wager.amount;
        }
    });
    
    saveUsers(users);
    
    // 删除相关下注
    const remainingWagers = wagers.filter(w => w.betId !== betId);
    saveWagers(remainingWagers);
    
    // 删除竞猜
    activeBets = activeBets.filter(b => b.id !== betId);
    saveActiveBets(activeBets);
    
    renderActiveBets();
    renderLeaderboard();
    renderUsersList();
}

function showSettleModal(betId) {
    const activeBets = getActiveBets();
    const bet = activeBets.find(b => b.id === betId);
    
    if (!bet) return;
    
    document.getElementById('settleBetId').value = betId;
    document.getElementById('settleTitle').textContent = bet.title;
    
    const container = document.getElementById('settleOptions');
    container.innerHTML = bet.options.map(opt => `
        <button class="settle-option" onclick="settleBet(${betId}, ${opt.id})">
            ${escapeHtml(opt.name)} (赔率 ×${opt.odds})
        </button>
    `).join('');
    
    openModal('settleModal');
}

function settleBet(betId, winningOptionId) {
    if (!confirm('确定选择此结果进行结算吗？')) return;
    
    let activeBets = getActiveBets();
    const bet = activeBets.find(b => b.id === betId);
    
    if (!bet) return;
    
    const wagers = getWagers();
    const users = getUsers();
    const winningOption = bet.options.find(o => o.id === winningOptionId);
    
    // 结算
    const betWagers = wagers.filter(w => w.betId === betId);
    const settleResults = [];
    
    betWagers.forEach(wager => {
        const user = users.find(u => u.id === wager.userId);
        if (!user) return;
        
        if (wager.optionId === winningOptionId) {
            const payout = Math.floor(wager.amount * wager.odds);
            user.points += payout;
            settleResults.push({
                userName: user.name,
                optionName: wager.optionName,
                amount: wager.amount,
                payout: payout,
                profit: payout - wager.amount,
                won: true
            });
        } else {
            settleResults.push({
                userName: user.name,
                optionName: wager.optionName,
                amount: wager.amount,
                payout: 0,
                profit: -wager.amount,
                won: false
            });
        }
    });
    
    saveUsers(users);
    
    // 保存到历史
    const history = getHistory();
    history.unshift({
        id: bet.id,
        title: bet.title,
        options: bet.options,
        winningOption: winningOption,
        results: settleResults,
        settledAt: new Date().toISOString()
    });
    
    if (history.length > 50) {
        history.splice(50);
    }
    saveHistory(history);
    
    // 删除相关下注
    const remainingWagers = wagers.filter(w => w.betId !== betId);
    saveWagers(remainingWagers);
    
    // 删除竞猜
    activeBets = activeBets.filter(b => b.id !== betId);
    saveActiveBets(activeBets);
    
    closeModal('settleModal');
    renderActiveBets();
    renderLeaderboard();
    renderUsersList();
    renderHistory();
    
    showSettleResultAlert(bet.title, winningOption.name, settleResults);
}

function settleAllBets() {
    const activeBets = getActiveBets();
    if (activeBets.length === 0) {
        alert('没有进行中的竞猜');
        return;
    }
    
    if (activeBets.length === 1) {
        showSettleModal(activeBets[0].id);
        return;
    }
    
    // 多个竞猜时显示选择
    const betList = activeBets.map(b => `• ${b.title}`).join('\n');
    alert(`当前有 ${activeBets.length} 个竞猜进行中：\n\n${betList}\n\n请点击各个竞猜的「结算」按钮分别结算。`);
}

function showSettleResultAlert(betTitle, winningName, results) {
    const winners = results.filter(r => r.won);
    const losers = results.filter(r => !r.won);
    
    let message = `🏁 结算完成！\n\n竞猜：${betTitle}\n正确结果：${winningName}\n\n`;
    
    if (winners.length > 0) {
        message += '🎉 中奖用户：\n';
        winners.forEach(r => {
            message += `  ${r.userName}: +${r.profit} 积分\n`;
        });
    }
    
    if (losers.length > 0) {
        message += '\n😢 未中奖用户：\n';
        losers.forEach(r => {
            message += `  ${r.userName}: ${r.profit} 积分\n`;
        });
    }
    
    if (results.length === 0) {
        message += '（本轮无人下注）';
    }
    
    alert(message);
}

// ===== 下注管理 =====
function submitWager(betId) {
    betId = Number(betId);
    
    const userSelect = document.getElementById(`wagerUser_${betId}`);
    const optionSelect = document.getElementById(`wagerOption_${betId}`);
    const amountInput = document.getElementById(`wagerAmount_${betId}`);
    
    const userId = parseInt(userSelect.value);
    const optionId = parseInt(optionSelect.value);
    const amount = parseInt(amountInput.value);
    
    if (!userId || !optionId || !amount) {
        alert('请填写完整的下注信息');
        return;
    }
    
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        alert('用户不存在');
        return;
    }
    
    if (amount > user.points) {
        alert(`积分不足！当前积分：${user.points}`);
        return;
    }
    
    if (amount <= 0) {
        alert('下注积分必须大于0');
        return;
    }
    
    const activeBets = getActiveBets();
    const bet = activeBets.find(b => Number(b.id) === betId);
    const option = bet.options.find(o => Number(o.id) === optionId);
    
    // 扣除积分
    user.points -= amount;
    saveUsers(users);
    
    // 更新选项总下注额
    option.totalAmount += amount;
    saveActiveBets(activeBets);
    
    // 保存下注记录
    const wagers = getWagers();
    wagers.push({
        id: Date.now(),
        betId: betId,
        userId: userId,
        userName: user.name,
        optionId: optionId,
        optionName: option.name,
        amount: amount,
        odds: option.odds,
        createdAt: new Date().toISOString()
    });
    saveWagers(wagers);
    
    // 重置表单
    amountInput.value = '';
    
    // 刷新界面
    renderActiveBets();
    renderLeaderboard();
    renderUsersList();
}

function deleteWager(wagerId) {
    if (!confirm('确定要删除此下注并退还积分吗？')) return;
    
    let wagers = getWagers();
    const wager = wagers.find(w => w.id === wagerId);
    
    if (!wager) return;
    
    // 退还积分
    const users = getUsers();
    const user = users.find(u => u.id === wager.userId);
    if (user) {
        user.points += wager.amount;
        saveUsers(users);
    }
    
    // 更新选项总下注额
    const activeBets = getActiveBets();
    const bet = activeBets.find(b => b.id === wager.betId);
    if (bet) {
        const option = bet.options.find(o => o.id === wager.optionId);
        if (option) {
            option.totalAmount -= wager.amount;
            saveActiveBets(activeBets);
        }
    }
    
    // 删除下注
    wagers = wagers.filter(w => w.id !== wagerId);
    saveWagers(wagers);
    
    renderActiveBets();
    renderLeaderboard();
    renderUsersList();
}

// ===== 渲染函数 =====
function renderLeaderboard() {
    const container = document.getElementById('leaderboardList');
    const users = getUsers();
    
    if (users.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无用户</p>';
        return;
    }
    
    const sorted = [...users].sort((a, b) => b.points - a.points);
    
    container.innerHTML = sorted.map((user, index) => `
        <div class="leaderboard-item">
            <span class="leaderboard-rank">${index + 1}</span>
            <span class="leaderboard-name">${escapeHtml(user.name)}</span>
            <span class="leaderboard-points">${user.points}</span>
        </div>
    `).join('');
}

function renderUsersList() {
    const container = document.getElementById('usersList');
    const users = getUsers();
    
    if (users.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无用户</p>';
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="user-item">
            <span class="user-name">${escapeHtml(user.name)}</span>
            <span class="user-points">${user.points} 分</span>
            <button class="user-delete" onclick="deleteUser(${user.id})" title="删除用户">🗑️</button>
        </div>
    `).join('');
}

function renderActiveBets() {
    const container = document.getElementById('activeBetsContainer');
    const activeBets = getActiveBets();
    const wagers = getWagers();
    const users = getUsers();
    
    if (activeBets.length === 0) {
        container.innerHTML = `
            <div class="no-bet-message">
                <p>🎯 暂无进行中的竞猜</p>
                <button class="btn btn-success btn-large" onclick="showCreateBetModal()">创建新竞猜</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activeBets.map(bet => {
        const betId = Math.floor(bet.id); // 确保是整数
        const betWagers = wagers.filter(w => Math.floor(w.betId) === betId);
        
        return `
            <div class="bet-card" data-bet-id="${betId}">
                <div class="bet-header">
                    <h3>${escapeHtml(bet.title)}</h3>
                    <span class="bet-status">进行中</span>
                </div>
                
                <!-- 下注表单：先选用户 -->
                <div class="wager-form-new">
                    <div class="wager-user-row">
                        <label>👤 选择用户：</label>
                        <select id="wagerUser_${betId}" onchange="onUserSelected(${betId})">
                            <option value="">-- 点击选择用户 --</option>
                            ${users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${u.points}分)</option>`).join('')}
                        </select>
                        <span class="selected-user-display" id="selectedUserDisplay_${betId}"></span>
                    </div>
                </div>
                
                <!-- 选项卡片（可点击选择） -->
                <div class="bet-options-clickable" id="betOptions_${betId}">
                    ${bet.options.map(opt => `
                        <div class="bet-option-card clickable" 
                             id="optionCard_${betId}_${opt.id}"
                             onclick="selectOption(${betId}, ${opt.id})"
                             data-option-id="${opt.id}">
                            <div class="bet-option-name">${escapeHtml(opt.name)}</div>
                            <div class="bet-option-odds">×${opt.odds}</div>
                            <div class="bet-option-total">已下注: ${opt.totalAmount} 分</div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- 隐藏的选中选项ID -->
                <input type="hidden" id="wagerOption_${betId}" value="">
                
                <!-- 积分输入和确认（选择选项后显示） -->
                <div class="wager-amount-row" id="wagerAmountRow_${betId}" style="display: none;">
                    <div class="wager-confirm-info">
                        <span id="wagerConfirmUser_${betId}"></span>
                        <span>选择了</span>
                        <span id="wagerConfirmOption_${betId}"></span>
                    </div>
                    <div class="wager-amount-input">
                        <label>下注积分：</label>
                        <input type="number" id="wagerAmount_${betId}" min="1" placeholder="输入积分" onkeypress="if(event.key==='Enter')submitWager(${betId})">
                        <button class="btn btn-success" onclick="submitWager(${betId})">✅ 确认下注</button>
                        <button class="btn btn-secondary" onclick="cancelWagerSelection(${betId})">取消</button>
                    </div>
                </div>
                
                ${betWagers.length > 0 ? `
                    <div class="wagers-list">
                        <h4>📋 本竞猜下注记录</h4>
                        ${betWagers.map(w => `
                            <div class="wager-item">
                                <span class="wager-user">${escapeHtml(w.userName)}</span>
                                <span class="wager-option">${escapeHtml(w.optionName)} (×${w.odds})</span>
                                <span class="wager-amount">${w.amount} 分</span>
                                <button class="wager-delete" onclick="deleteWager(${w.id})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="bet-actions">
                    <button class="btn btn-success" onclick="showSettleModal(${betId})">🏁 结算</button>
                    <button class="btn btn-secondary" onclick="cancelBet(${betId})">❌ 取消</button>
                </div>
            </div>
        `;
    }).join('');
}

// 用户选择后的回调
function onUserSelected(betId) {
    const userSelect = document.getElementById(`wagerUser_${betId}`);
    const userId = userSelect.value;
    const display = document.getElementById(`selectedUserDisplay_${betId}`);
    
    if (userId) {
        const users = getUsers();
        const user = users.find(u => u.id === parseInt(userId));
        if (user) {
            display.innerHTML = `<strong>${escapeHtml(user.name)}</strong> (${user.points}分) - 请点击下方选项`;
            display.classList.add('active');
        }
    } else {
        display.innerHTML = '';
        display.classList.remove('active');
        cancelWagerSelection(betId);
    }
}

// 点击选项卡片
function selectOption(betId, optionId) {
    // 确保ID是数字类型
    betId = Number(betId);
    optionId = Number(optionId);
    
    const userSelect = document.getElementById(`wagerUser_${betId}`);
    if (!userSelect) {
        console.error('User select not found for betId:', betId);
        return;
    }
    
    const userId = userSelect.value;
    
    if (!userId) {
        alert('请先选择用户！');
        return;
    }
    
    const users = getUsers();
    const user = users.find(u => u.id === parseInt(userId));
    const activeBets = getActiveBets();
    const bet = activeBets.find(b => Number(b.id) === betId);
    
    if (!bet) {
        console.error('Bet not found:', betId);
        return;
    }
    
    const option = bet.options.find(o => Number(o.id) === optionId);
    
    if (!option) {
        console.error('Option not found:', optionId);
        return;
    }
    
    // 移除其他选项的选中状态
    const optionsContainer = document.getElementById(`betOptions_${betId}`);
    if (optionsContainer) {
        optionsContainer.querySelectorAll('.bet-option-card').forEach(card => {
            card.classList.remove('selected');
        });
    }
    
    // 添加当前选项的选中状态
    const optionCard = document.getElementById(`optionCard_${betId}_${optionId}`);
    if (optionCard) {
        optionCard.classList.add('selected');
    }
    
    // 设置隐藏字段
    document.getElementById(`wagerOption_${betId}`).value = optionId;
    
    // 显示确认区域
    const amountRow = document.getElementById(`wagerAmountRow_${betId}`);
    amountRow.style.display = 'block';
    
    // 更新确认信息
    document.getElementById(`wagerConfirmUser_${betId}`).innerHTML = `<strong>${escapeHtml(user.name)}</strong>`;
    document.getElementById(`wagerConfirmOption_${betId}`).innerHTML = `<strong>「${escapeHtml(option.name)}」×${option.odds}</strong>`;
    
    // 聚焦到积分输入框
    document.getElementById(`wagerAmount_${betId}`).focus();
}

// 取消选择
function cancelWagerSelection(betId) {
    betId = Number(betId);
    
    // 移除选中状态
    const container = document.getElementById(`betOptions_${betId}`);
    if (container) {
        container.querySelectorAll('.bet-option-card').forEach(card => {
            card.classList.remove('selected');
        });
    }
    
    // 隐藏确认区域
    const amountRow = document.getElementById(`wagerAmountRow_${betId}`);
    if (amountRow) amountRow.style.display = 'none';
    
    const optionInput = document.getElementById(`wagerOption_${betId}`);
    if (optionInput) optionInput.value = '';
    
    const amountInput = document.getElementById(`wagerAmount_${betId}`);
    if (amountInput) amountInput.value = '';
}

function updateAllWagerUserSelects() {
    const activeBets = getActiveBets();
    const users = getUsers();
    
    activeBets.forEach(bet => {
        const select = document.getElementById(`wagerUser_${bet.id}`);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">选择用户</option>' +
                users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${u.points}分)</option>`).join('');
            if (currentValue) select.value = currentValue;
        }
    });
}

function renderHistory() {
    const container = document.getElementById('historyList');
    const history = getHistory();
    
    if (history.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无历史记录</p>';
        return;
    }
    
    container.innerHTML = history.map(h => {
        const winners = h.results.filter(r => r.won);
        const totalBet = h.results.reduce((sum, r) => sum + r.amount, 0);
        const totalPayout = h.results.reduce((sum, r) => sum + r.payout, 0);
        
        return `
            <div class="history-item">
                <div class="history-title">${escapeHtml(h.title)}</div>
                <div class="history-result">✅ 结果：${escapeHtml(h.winningOption.name)}</div>
                <div class="history-details">
                    总下注: ${totalBet} | 总派奖: ${totalPayout} | 
                    中奖: ${winners.length}/${h.results.length}人
                </div>
            </div>
        `;
    }).join('');
}

// ===== 对赌管理 =====
function showCreateDuelModal() {
    const users = getUsers();
    if (users.length < 2) {
        alert('至少需要2个用户才能创建对赌');
        return;
    }
    
    // 渲染关卡选择
    const stageSelect = document.getElementById('duelStageSelect');
    const currentStage = getCurrentStage();
    stageSelect.innerHTML = STAGES.map(s => 
        `<option value="${s.id}" ${s.id === currentStage ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    
    // 渲染竞猜内容
    updateDuelBets();
    
    // 渲染用户选择
    const player1Select = document.getElementById('duelPlayer1');
    const player2Select = document.getElementById('duelPlayer2');
    const userOptions = users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${u.points}分)</option>`).join('');
    player1Select.innerHTML = '<option value="">-- 选择 --</option>' + userOptions;
    player2Select.innerHTML = '<option value="">-- 选择 --</option>' + userOptions;
    
    // 清空金额
    document.getElementById('duelAmount1').value = '';
    document.getElementById('duelAmount2').value = '';
    
    openModal('createDuelModal');
}

function updateDuelBets() {
    const stageId = parseInt(document.getElementById('duelStageSelect').value);
    const stage = STAGES.find(s => s.id === stageId);
    
    if (!stage) return;
    
    const betSelect = document.getElementById('duelBetSelect');
    betSelect.innerHTML = stage.bets.map((bet, idx) => 
        `<option value="${idx}">${bet.title}</option>`
    ).join('');
    
    updateDuelOptions();
}

function updateDuelOptions() {
    const stageId = parseInt(document.getElementById('duelStageSelect').value);
    const betIdx = parseInt(document.getElementById('duelBetSelect').value);
    const stage = STAGES.find(s => s.id === stageId);
    
    if (!stage || isNaN(betIdx)) return;
    
    const bet = stage.bets[betIdx];
    const optionsHtml = bet.options.map((opt, idx) => 
        `<option value="${idx}">${escapeHtml(opt.name)}</option>`
    ).join('');
    
    document.getElementById('duelOption1').innerHTML = optionsHtml;
    document.getElementById('duelOption2').innerHTML = optionsHtml;
    
    // 默认选择不同选项
    if (bet.options.length >= 2) {
        document.getElementById('duelOption1').value = '0';
        document.getElementById('duelOption2').value = '1';
    }
}

function createDuel(event) {
    event.preventDefault();
    
    const stageId = parseInt(document.getElementById('duelStageSelect').value);
    const betIdx = parseInt(document.getElementById('duelBetSelect').value);
    const stage = STAGES.find(s => s.id === stageId);
    const bet = stage.bets[betIdx];
    
    const player1Id = parseInt(document.getElementById('duelPlayer1').value);
    const player2Id = parseInt(document.getElementById('duelPlayer2').value);
    const option1Idx = parseInt(document.getElementById('duelOption1').value);
    const option2Idx = parseInt(document.getElementById('duelOption2').value);
    const amount1 = parseInt(document.getElementById('duelAmount1').value);
    const amount2 = parseInt(document.getElementById('duelAmount2').value);
    
    // 验证
    if (!player1Id || !player2Id) {
        alert('请选择两个用户');
        return;
    }
    
    if (player1Id === player2Id) {
        alert('不能选择同一个用户');
        return;
    }
    
    if (option1Idx === option2Idx) {
        alert('两个玩家不能选择相同的立场');
        return;
    }
    
    if (!amount1 || !amount2 || amount1 <= 0 || amount2 <= 0) {
        alert('请输入有效的下注金额');
        return;
    }
    
    const users = getUsers();
    const player1 = users.find(u => u.id === player1Id);
    const player2 = users.find(u => u.id === player2Id);
    
    if (amount1 > player1.points) {
        alert(`${player1.name} 积分不足！当前积分：${player1.points}`);
        return;
    }
    
    if (amount2 > player2.points) {
        alert(`${player2.name} 积分不足！当前积分：${player2.points}`);
        return;
    }
    
    // 扣除积分
    player1.points -= amount1;
    player2.points -= amount2;
    saveUsers(users);
    
    // 创建对赌
    const duels = getDuels();
    duels.push({
        id: Date.now(),
        stageId: stageId,
        stageName: stage.name,
        betTitle: bet.title,
        options: bet.options,
        player1: {
            id: player1Id,
            name: player1.name,
            optionIdx: option1Idx,
            optionName: bet.options[option1Idx].name,
            amount: amount1
        },
        player2: {
            id: player2Id,
            name: player2.name,
            optionIdx: option2Idx,
            optionName: bet.options[option2Idx].name,
            amount: amount2
        },
        status: 'active',
        createdAt: new Date().toISOString()
    });
    saveDuels(duels);
    
    closeModal('createDuelModal');
    renderDuels();
    renderLeaderboard();
    renderUsersList();
    
    alert(`对赌创建成功！\n${player1.name}「${bet.options[option1Idx].name}」${amount1}分\nvs\n${player2.name}「${bet.options[option2Idx].name}」${amount2}分`);
}

function cancelDuel(duelId) {
    if (!confirm('确定要取消此对赌吗？积分将退还给双方。')) return;
    
    let duels = getDuels();
    const duel = duels.find(d => d.id === duelId);
    
    if (!duel) return;
    
    // 退还积分
    const users = getUsers();
    const player1 = users.find(u => u.id === duel.player1.id);
    const player2 = users.find(u => u.id === duel.player2.id);
    
    if (player1) player1.points += duel.player1.amount;
    if (player2) player2.points += duel.player2.amount;
    saveUsers(users);
    
    // 删除对赌
    duels = duels.filter(d => d.id !== duelId);
    saveDuels(duels);
    
    renderDuels();
    renderLeaderboard();
    renderUsersList();
}

function showSettleDuelModal(duelId) {
    const duels = getDuels();
    const duel = duels.find(d => d.id === duelId);
    
    if (!duel) return;
    
    document.getElementById('settleDuelId').value = duelId;
    document.getElementById('settleDuelTitle').textContent = `${duel.stageName} - ${duel.betTitle}`;
    
    // 显示对赌信息
    document.getElementById('settleDuelInfo').innerHTML = `
        <div class="duel-settle-players">
            <div class="duel-settle-player">
                <div class="duel-settle-player-name">${escapeHtml(duel.player1.name)}</div>
                <div class="duel-settle-player-bet">「${escapeHtml(duel.player1.optionName)}」${duel.player1.amount}分</div>
            </div>
            <div style="font-weight:bold;color:var(--accent-red);">VS</div>
            <div class="duel-settle-player">
                <div class="duel-settle-player-name">${escapeHtml(duel.player2.name)}</div>
                <div class="duel-settle-player-bet">「${escapeHtml(duel.player2.optionName)}」${duel.player2.amount}分</div>
            </div>
        </div>
    `;
    
    // 显示选项按钮（只显示两个玩家选择的选项）
    const container = document.getElementById('settleDuelOptions');
    container.innerHTML = `
        <button class="settle-option" onclick="settleDuel(${duelId}, ${duel.player1.optionIdx})">
            ${escapeHtml(duel.player1.optionName)}（${escapeHtml(duel.player1.name)} 胜）
        </button>
        <button class="settle-option" onclick="settleDuel(${duelId}, ${duel.player2.optionIdx})">
            ${escapeHtml(duel.player2.optionName)}（${escapeHtml(duel.player2.name)} 胜）
        </button>
    `;
    
    openModal('settleDuelModal');
}

function settleDuel(duelId, winningOptionIdx) {
    if (!confirm('确定选择此结果进行结算吗？')) return;
    
    let duels = getDuels();
    const duel = duels.find(d => d.id === duelId);
    
    if (!duel) return;
    
    const users = getUsers();
    const totalPot = duel.player1.amount + duel.player2.amount;
    
    let winner, loser, winnerData, loserData;
    
    if (duel.player1.optionIdx === winningOptionIdx) {
        winner = users.find(u => u.id === duel.player1.id);
        loser = users.find(u => u.id === duel.player2.id);
        winnerData = duel.player1;
        loserData = duel.player2;
    } else {
        winner = users.find(u => u.id === duel.player2.id);
        loser = users.find(u => u.id === duel.player1.id);
        winnerData = duel.player2;
        loserData = duel.player1;
    }
    
    // 发放奖金
    if (winner) {
        winner.points += totalPot;
    }
    saveUsers(users);
    
    // 保存到历史
    const duelHistory = getDuelHistory();
    duelHistory.unshift({
        ...duel,
        winnerId: winnerData.id,
        winnerName: winnerData.name,
        winningOption: winnerData.optionName,
        totalPot: totalPot,
        settledAt: new Date().toISOString()
    });
    if (duelHistory.length > 50) duelHistory.splice(50);
    saveDuelHistory(duelHistory);
    
    // 删除对赌
    duels = duels.filter(d => d.id !== duelId);
    saveDuels(duels);
    
    closeModal('settleDuelModal');
    renderDuels();
    renderLeaderboard();
    renderUsersList();
    
    const profit = totalPot - winnerData.amount;
    alert(`🏆 对赌结算完成！\n\n结果：${winnerData.optionName}\n\n${winnerData.name} 获胜！\n获得 ${totalPot} 积分（净赚 ${profit}）\n\n${loserData.name} 落败，损失 ${loserData.amount} 积分`);
}

function renderDuels() {
    const container = document.getElementById('duelList');
    const duels = getDuels();
    
    if (duels.length === 0) {
        container.innerHTML = '<p class="empty-message">暂无对赌</p>';
        return;
    }
    
    container.innerHTML = duels.map(duel => `
        <div class="duel-card">
            <div class="duel-card-title">${escapeHtml(duel.stageName)} - ${escapeHtml(duel.betTitle)}</div>
            <div class="duel-card-content">
                <div class="duel-player">
                    <div class="duel-player-name">${escapeHtml(duel.player1.name)}</div>
                    <div class="duel-player-option">「${escapeHtml(duel.player1.optionName)}」</div>
                    <div class="duel-player-amount">${duel.player1.amount} 分</div>
                </div>
                <div class="duel-vs-small">VS</div>
                <div class="duel-player">
                    <div class="duel-player-name">${escapeHtml(duel.player2.name)}</div>
                    <div class="duel-player-option">「${escapeHtml(duel.player2.optionName)}」</div>
                    <div class="duel-player-amount">${duel.player2.amount} 分</div>
                </div>
            </div>
            <div class="duel-card-actions">
                <button class="btn btn-success btn-small" onclick="showSettleDuelModal(${duel.id})">🏁 结算</button>
                <button class="btn btn-secondary btn-small" onclick="cancelDuel(${duel.id})">❌ 取消</button>
            </div>
        </div>
    `).join('');
}

// ===== 模态框 =====
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// ===== 工具函数 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
