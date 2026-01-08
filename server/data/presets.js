/**
 * Betting Presets Loader
 * Loads betting presets from BettingPresets.csv
 */

const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '../../BettingPresets.csv');

let STAGES = [];
let stagesLoaded = false;

// Parse CSV file
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

// Build STAGES data from CSV
function buildStagesFromCSV(csvData) {
    const stagesMap = new Map();
    
    csvData.forEach(row => {
        const stageId = parseInt(row['关卡ID']);
        const stageName = row['关卡名称'];
        const difficulty = row['难度定位'];
        const betTitle = row['竞猜标题'];
        
        if (!stageId || !stageName || !betTitle) return;
        
        // Get or create stage
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
        
        // Build options
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
    
    // Convert to array and sort
    return Array.from(stagesMap.values()).sort((a, b) => a.id - b.id);
}

// Load presets from CSV file
function loadPresets() {
    try {
        if (fs.existsSync(CSV_FILE)) {
            const csvText = fs.readFileSync(CSV_FILE, 'utf8');
            const csvData = parseCSV(csvText);
            STAGES = buildStagesFromCSV(csvData);
            stagesLoaded = true;
            console.log('Loaded', STAGES.length, 'stages from CSV');
            return true;
        }
    } catch (error) {
        console.error('Error loading CSV:', error);
    }
    
    // Use default data as fallback
    STAGES = getDefaultStages();
    stagesLoaded = true;
    return false;
}

// Default stages (fallback)
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
        ]}
    ];
}

// Get all stages
function getStages() {
    if (!stagesLoaded) {
        loadPresets();
    }
    return STAGES;
}

// Get a specific stage by ID
function getStage(stageId) {
    return getStages().find(s => s.id === stageId);
}

module.exports = {
    loadPresets,
    getStages,
    getStage
};
