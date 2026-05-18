/**
 * @copyright 2026 Alexander von Pidoll
 * All rights reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * in whole or in part, via any medium, is strictly prohibited.
 */

/**
 * Notifier
 *
 * Handles sending notifications to connected clients.
 */

const database = require('./database');

/**
 * Connected users map: userId -> Set of socket IDs
 */
const connectedUsers = new Map();

/**
 * Socket instances map: socketId -> socket
 */
const sockets = new Map();

/**
 * Register a connected user
 *
 * @param {Socket} socket - Socket.io socket
 */
function registerConnection(socket) {
    const userId = socket.userId;
    const socketId = socket.id;

    // Add to user connections
    if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socketId);

    // Store socket reference
    sockets.set(socketId, socket);

    console.log(`[Notifier] User ${userId} connected (socket: ${socketId})`);
    console.log(`[Notifier] Total connected users: ${connectedUsers.size}`);
}

/**
 * Unregister a disconnected user
 *
 * @param {Socket} socket - Socket.io socket
 */
function unregisterConnection(socket) {
    const userId = socket.userId;
    const socketId = socket.id;

    // Remove from user connections
    if (connectedUsers.has(userId)) {
        const userSockets = connectedUsers.get(userId);
        userSockets.delete(socketId);

        if (userSockets.size === 0) {
            connectedUsers.delete(userId);
        }
    }

    // Remove socket reference
    sockets.delete(socketId);

    console.log(`[Notifier] User ${userId} disconnected (socket: ${socketId})`);
}

/**
 * Check if a user is connected
 *
 * @param {number} userId - User ID
 * @returns {boolean}
 */
function isUserConnected(userId) {
    return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
}

/**
 * Get connected socket IDs for a user
 *
 * @param {number} userId - User ID
 * @returns {Array<string>}
 */
function getUserSockets(userId) {
    if (!connectedUsers.has(userId)) {
        return [];
    }
    return Array.from(connectedUsers.get(userId));
}

/**
 * Send a notification to a user
 *
 * @param {number} userId - User ID
 * @param {Object} notification - Notification data
 * @returns {boolean} True if sent to at least one socket
 */
function sendToUser(userId, notification) {
    const socketIds = getUserSockets(userId);

    if (socketIds.length === 0) {
        console.log(`[Notifier] User ${userId} not connected, notification queued`);
        return false;
    }

    let sent = false;
    for (const socketId of socketIds) {
        const socket = sockets.get(socketId);
        if (socket) {
            socket.emit('notification', {
                id: notification.id,
                type: notification.type,
                payload: {
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
                    priority: notification.priority,
                    source: {
                        type: notification.source,
                        icon: getSourceIcon(notification.source),
                        name: getSourceName(notification.source)
                    },
                    actions: parseActions(notification.actions),
                    data: parseData(notification.data),
                    timestamp: notification.created_at
                }
            });
            sent = true;
        }
    }

    // Mark as sent in database
    if (sent && notification.id) {
        database.markNotificationSent(notification.id);
    }

    return sent;
}

/**
 * Send to all sockets of a user
 *
 * @param {number} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function emitToUser(userId, event, data) {
    const socketIds = getUserSockets(userId);

    for (const socketId of socketIds) {
        const socket = sockets.get(socketId);
        if (socket) {
            socket.emit(event, data);
        }
    }
}

/**
 * Broadcast to all connected users
 *
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcast(event, data) {
    for (const [socketId, socket] of sockets) {
        socket.emit(event, data);
    }
}

/**
 * Get icon for a source
 *
 * @param {string} source - Source name
 * @returns {string}
 */
function getSourceIcon(source) {
    const icons = {
        'flowengine': '📋',
        'catalyst': '📊',
        'calendar': '📅',
        'system': '⚙️',
        'tasks': '✅'
    };
    return icons[source] || '🔔';
}

/**
 * Get display name for a source
 *
 * @param {string} source - Source name
 * @returns {string}
 */
function getSourceName(source) {
    const names = {
        'flowengine': 'FlowEngine',
        'catalyst': 'Catalyst',
        'calendar': 'Team Kalender',
        'system': 'System',
        'tasks': 'Aufgaben'
    };
    return names[source] || source;
}

/**
 * Parse JSON actions
 *
 * @param {string|Array|null} actions - Actions data
 * @returns {Array}
 */
function parseActions(actions) {
    if (!actions) return [];
    if (Array.isArray(actions)) return actions;
    try {
        return JSON.parse(actions);
    } catch {
        return [];
    }
}

/**
 * Parse JSON data
 *
 * @param {string|Object|null} data - Data
 * @returns {Object}
 */
function parseData(data) {
    if (!data) return {};
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return {};
    }
}

/**
 * Get connection statistics
 *
 * @returns {Object}
 */
function getStats() {
    return {
        totalUsers: connectedUsers.size,
        totalSockets: sockets.size,
        users: Array.from(connectedUsers.entries()).map(([userId, socketIds]) => ({
            userId,
            connections: socketIds.size
        }))
    };
}

module.exports = {
    registerConnection,
    unregisterConnection,
    isUserConnected,
    getUserSockets,
    sendToUser,
    emitToUser,
    broadcast,
    getStats
};
