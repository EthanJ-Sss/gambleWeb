/**
 * JSON File Storage Utility
 * Simple persistence layer for room data
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

// Ensure data directory exists
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// Load all rooms from JSON file
function loadRooms() {
    ensureDataDir();
    try {
        if (fs.existsSync(ROOMS_FILE)) {
            const data = fs.readFileSync(ROOMS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading rooms:', error);
    }
    return {};
}

// Save all rooms to JSON file
function saveRooms(rooms) {
    ensureDataDir();
    try {
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving rooms:', error);
    }
}

// Get a specific room by code
function getRoom(code) {
    const rooms = loadRooms();
    return rooms[code] || null;
}

// Save a specific room
function saveRoom(room) {
    const rooms = loadRooms();
    rooms[room.code] = room;
    saveRooms(rooms);
}

// Delete a room
function deleteRoom(code) {
    const rooms = loadRooms();
    delete rooms[code];
    saveRooms(rooms);
}

// Get all active rooms
function getActiveRooms() {
    const rooms = loadRooms();
    return Object.values(rooms).filter(r => r.status === 'active');
}

module.exports = {
    loadRooms,
    saveRooms,
    getRoom,
    saveRoom,
    deleteRoom,
    getActiveRooms
};
