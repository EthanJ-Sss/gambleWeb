/**
 * Socket.IO Client Wrapper
 * Shared socket connection handling for dealer and player clients
 */

class SocketClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.connecting = false;
    }
    
    // Connect to server
    connect(url = '') {
        // Already connected
        if (this.connected && this.socket) {
            console.log('Already connected');
            return Promise.resolve();
        }
        
        // Already connecting
        if (this.connecting) {
            console.log('Connection in progress...');
            return new Promise((resolve) => {
                const checkConnection = setInterval(() => {
                    if (this.connected) {
                        clearInterval(checkConnection);
                        resolve();
                    }
                }, 100);
            });
        }
        
        this.connecting = true;
        
        return new Promise((resolve, reject) => {
            try {
                this.socket = io(url, {
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: 10000
                });
            } catch (error) {
                console.error('Failed to create socket:', error);
                this.connecting = false;
                reject(error);
                return;
            }
            
            // Set a timeout for connection
            const connectionTimeout = setTimeout(() => {
                if (!this.connected) {
                    console.error('Connection timeout');
                    this.connecting = false;
                    reject(new Error('Connection timeout'));
                }
            }, 15000);
            
            this.socket.on('connect', () => {
                console.log('Connected to server');
                clearTimeout(connectionTimeout);
                this.connected = true;
                this.connecting = false;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.trigger('connected');
                resolve();
            });
            
            this.socket.on('disconnect', (reason) => {
                console.log('Disconnected from server:', reason);
                this.connected = false;
                this.updateConnectionStatus(false);
                this.trigger('disconnected', { reason });
            });
            
            this.socket.on('reconnect_attempt', (attempt) => {
                console.log('Reconnection attempt:', attempt);
                this.reconnectAttempts = attempt;
                this.trigger('reconnecting', { attempt });
            });
            
            this.socket.on('reconnect', () => {
                console.log('Reconnected to server');
                this.connected = true;
                this.updateConnectionStatus(true);
                this.trigger('reconnected');
            });
            
            this.socket.on('reconnect_failed', () => {
                console.log('Reconnection failed');
                this.trigger('reconnect_failed');
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                clearTimeout(connectionTimeout);
                this.connecting = false;
                reject(error);
            });
            
            // Forward all room events
            const roomEvents = [
                'room:player_joined',
                'room:player_left',
                'room:player_reconnected',
                'room:player_offline',
                'room:round_started',
                'room:bet_created',
                'room:betting_opened',
                'room:betting_locked',
                'room:wager_placed',
                'room:wager_cancelled',
                'room:bet_settled',
                'room:round_ended',
                'room:closing',
                'room:closed'
            ];
            
            roomEvents.forEach(event => {
                this.socket.on(event, (data) => this.trigger(event, data));
            });
            
            // Forward self events
            const selfEvents = [
                'self:joined',
                'self:rejoined',
                'self:wager_confirmed',
                'self:wager_rejected',
                'self:settle_result',
                'self:stats_updated',
                'self:kicked'
            ];
            
            selfEvents.forEach(event => {
                this.socket.on(event, (data) => this.trigger(event, data));
            });
            
            // Forward dealer events
            this.socket.on('dealer:room_created', (data) => this.trigger('dealer:room_created', data));
            
            // Forward error events
            this.socket.on('error', (data) => this.trigger('error', data));
        });
    }
    
    // Update connection status indicator
    updateConnectionStatus(connected) {
        let indicator = document.querySelector('.connection-status');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'connection-status';
            document.body.appendChild(indicator);
        }
        
        if (connected) {
            indicator.className = 'connection-status connected';
            indicator.textContent = '🟢 已连接';
            // Hide after 3 seconds when connected
            setTimeout(() => {
                indicator.style.opacity = '0';
            }, 3000);
        } else {
            indicator.className = 'connection-status disconnected';
            indicator.textContent = '🔴 连接断开';
            indicator.style.opacity = '1';
        }
    }
    
    // Send event to server
    emit(event, data) {
        if (this.socket && this.connected) {
            this.socket.emit(event, data);
            return true;
        }
        console.warn('Cannot emit, socket not connected');
        return false;
    }
    
    // Register event handler
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    // Remove event handler
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    // Trigger event handlers
    trigger(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in handler for ${event}:`, error);
                }
            });
        }
    }
    
    // Check if connected
    isConnected() {
        return this.connected;
    }
    
    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.connecting = false;
        }
    }
}

// Global instance
const socketClient = new SocketClient();
