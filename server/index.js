/**
 * Main Server Entry Point
 * Express + Socket.IO server for the betting platform
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const presets = require('./data/presets');
const { initializeSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use('/client', express.static(path.join(__dirname, '../client')));
app.use('/shared', express.static(path.join(__dirname, '../client/shared')));

// Serve dealer page
app.get('/dealer', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dealer/index.html'));
});

// Serve player page
app.get('/player', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/player/index.html'));
});

// Serve player page with room code
app.get('/player/:roomCode', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/player/index.html'));
});

// Default redirect to player page
app.get('/', (req, res) => {
    res.redirect('/player');
});

// API: Get betting presets
app.get('/api/presets', (req, res) => {
    res.json(presets.getStages());
});

// API: Get specific stage
app.get('/api/presets/:stageId', (req, res) => {
    const stage = presets.getStage(parseInt(req.params.stageId));
    if (stage) {
        res.json(stage);
    } else {
        res.status(404).json({ error: 'Stage not found' });
    }
});

// Initialize presets
presets.loadPresets();

// Initialize Socket.IO
initializeSocket(io);

// Start server
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         🎮 对战竞猜平台 - 服务器已启动                     ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║   服务器地址: http://localhost:${PORT}                       ║
║                                                            ║
║   庄家端: http://localhost:${PORT}/dealer                    ║
║   玩家端: http://localhost:${PORT}/player                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});
