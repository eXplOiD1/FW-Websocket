/**
 * @copyright 2026 Alexander von Pidoll
 * All rights reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * in whole or in part, via any medium, is strictly prohibited.
 */

/**
 * WebSocket Server
 *
 * Real-time notification server using Socket.io.
 * Provides:
 * - Real-time notification delivery
 * - Multi-device support
 * - HTTP API for triggering notifications from PHP
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const config = require('./config');
const { authMiddleware } = require('./lib/auth');
const database = require('./lib/database');
const notifier = require('./lib/notifier');

// Create Express app
const app = express();
app.use(cors(config.cors));
app.use(express.json());

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.io server
const io = new Server(httpServer, {
    cors: config.cors,
    pingInterval: config.connection.pingInterval,
    pingTimeout: config.connection.pingTimeout
});

// Apply authentication middleware
io.use(authMiddleware);

// Handle socket connections
io.on('connection', async (socket) => {
    console.log(`[Server] New connection: ${socket.id} (User: ${socket.userId})`);

    // Register the connection
    notifier.registerConnection(socket);

    // Send pending notifications
    try {
        const pending = await database.getPendingNotifications(socket.userId);
        for (const notification of pending) {
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
                    actions: parseJSON(notification.actions),
                    data: parseJSON(notification.data),
                    timestamp: notification.created_at
                }
            });
        }

        // Send unread count
        const unreadCount = await database.getUnreadCount(socket.userId);
        socket.emit('unread_count', { count: unreadCount });
    } catch (error) {
        console.error('[Server] Error sending pending notifications:', error.message);
    }

    // Handle notification read
    socket.on('notification:read', async (data) => {
        const { id } = data;
        if (id) {
            await database.markNotificationRead(id);

            // Sync to all user's devices
            const unreadCount = await database.getUnreadCount(socket.userId);
            notifier.emitToUser(socket.userId, 'unread_count', { count: unreadCount });
            notifier.emitToUser(socket.userId, 'notification:updated', { id, status: 'read' });
        }
    });

    // Handle sync request
    socket.on('sync:request', async () => {
        try {
            const notifications = await database.getPendingNotifications(socket.userId);
            const unreadCount = await database.getUnreadCount(socket.userId);

            socket.emit('sync:response', {
                notifications: notifications.map(n => ({
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    priority: n.priority,
                    source: n.source,
                    actions: parseJSON(n.actions),
                    data: parseJSON(n.data),
                    status: n.status,
                    created_at: n.created_at
                })),
                unread_count: unreadCount
            });
        } catch (error) {
            console.error('[Server] Sync error:', error.message);
            socket.emit('sync:error', { error: error.message });
        }
    });

    // Handle action execution
    socket.on('action:execute', async (data) => {
        const { notification_id, action_id, task_id } = data;

        try {
            // Call PHP API to execute action
            const reqHeaders = {
                'Content-Type': 'application/json',
                'X-Internal-Request': 'true'
            };
            if (config.api.internalSecret) {
                reqHeaders['X-Internal-Secret'] = config.api.internalSecret;
            }
            const response = await fetch(`${config.api.baseUrl}/api/task-action.php`, {
                method: 'POST',
                headers: reqHeaders,
                body: JSON.stringify({
                    action: 'execute',
                    task_id,
                    action_id,
                    notification_id
                })
            });

            const result = await response.json();
            socket.emit('action:result', {
                notification_id,
                action_id,
                ...result
            });

            // If action succeeded, update unread count
            if (result.success) {
                const unreadCount = await database.getUnreadCount(socket.userId);
                notifier.emitToUser(socket.userId, 'unread_count', { count: unreadCount });
            }
        } catch (error) {
            socket.emit('action:result', {
                notification_id,
                action_id,
                success: false,
                error: error.message
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`[Server] Disconnect: ${socket.id} (Reason: ${reason})`);
        notifier.unregisterConnection(socket);
    });
});

// HTTP API for triggering notifications from PHP
app.post('/api/notify', async (req, res) => {
    const { user_id, notification } = req.body;

    if (!user_id || !notification) {
        return res.status(400).json({ success: false, error: 'user_id and notification required' });
    }

    const sent = notifier.sendToUser(user_id, notification);

    res.json({
        success: true,
        delivered: sent,
        online: notifier.isUserConnected(user_id)
    });
});

// Transient UI broadcast — NOT persisted as a notification.
//
// Used by PHP (best-effort, fire-and-forget) to push a lightweight
// "something dashboard-relevant changed" ping so any connected
// FlowEngine dashboards refresh live without waiting for their
// fingerprint poll. Deliberately does NOT touch the notification DB
// (this is a UI signal, not a user notification — keeps it out of the
// bell/center per the central-notification rules). Safe to fail: the
// client-side fingerprint poll is the always-on fallback, so an
// install without this WS server simply degrades to ~8s poll latency.
app.post('/api/broadcast', (req, res) => {
    const { event, payload, user_id } = req.body || {};
    if (!event) {
        return res.status(400).json({ success: false, error: 'event required' });
    }
    try {
        if (user_id) {
            notifier.emitToUser(user_id, event, payload || {});
        } else {
            io.emit(event, payload || {});
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get server stats
app.get('/api/stats', (req, res) => {
    res.json(notifier.getStats());
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper functions
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

function parseJSON(data) {
    if (!data) return null;
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Server] Shutting down...');

    // Close all socket connections
    io.close();

    // Close database pool
    await database.closePool();

    process.exit(0);
});

// Start server
httpServer.listen(config.port, config.host, () => {
    console.log(`[Server] WebSocket server running on ${config.host}:${config.port}`);
});
