/**
 * @copyright 2026 Alexander von Pidoll
 * All rights reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * in whole or in part, via any medium, is strictly prohibited.
 */

/**
 * Database Handler
 *
 * MySQL connection pool for the WebSocket server.
 */

const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

/**
 * Get or create the database connection pool
 *
 * @returns {Promise<Pool>}
 */
async function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    return pool;
}

/**
 * Get table name with prefix
 *
 * @param {string} name - Base table name
 * @returns {string} Full table name
 */
function tableName(name) {
    return config.database.tablePrefix + name;
}

/**
 * Get pending notifications for a user
 *
 * @param {number} userId - User ID
 * @returns {Promise<Array>}
 */
async function getPendingNotifications(userId) {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute(
            `SELECT * FROM ${tableName('notification_queue')}
             WHERE user_id = ? AND status IN ('pending', 'sent')
             ORDER BY created_at DESC
             LIMIT 100`,
            [userId]
        );
        return rows;
    } catch (error) {
        console.error('[Database] Error getting notifications:', error.message);
        return [];
    }
}

/**
 * Mark a notification as sent
 *
 * @param {number} notificationId - Notification ID
 * @returns {Promise<boolean>}
 */
async function markNotificationSent(notificationId) {
    try {
        const pool = await getPool();
        await pool.execute(
            `UPDATE ${tableName('notification_queue')}
             SET status = 'sent', sent_at = NOW()
             WHERE id = ?`,
            [notificationId]
        );
        return true;
    } catch (error) {
        console.error('[Database] Error marking notification sent:', error.message);
        return false;
    }
}

/**
 * Mark a notification as read
 *
 * @param {number} notificationId - Notification ID
 * @returns {Promise<boolean>}
 */
async function markNotificationRead(notificationId) {
    try {
        const pool = await getPool();
        await pool.execute(
            `UPDATE ${tableName('notification_queue')}
             SET status = 'read', read_at = NOW()
             WHERE id = ?`,
            [notificationId]
        );
        return true;
    } catch (error) {
        console.error('[Database] Error marking notification read:', error.message);
        return false;
    }
}

/**
 * Get unread count for a user
 *
 * @param {number} userId - User ID
 * @returns {Promise<number>}
 */
async function getUnreadCount(userId) {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute(
            `SELECT COUNT(*) as count FROM ${tableName('notification_queue')}
             WHERE user_id = ? AND status IN ('pending', 'sent')`,
            [userId]
        );
        return rows[0]?.count || 0;
    } catch (error) {
        console.error('[Database] Error getting unread count:', error.message);
        return 0;
    }
}

/**
 * Get user preferences
 *
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
async function getUserPreferences(userId) {
    try {
        const pool = await getPool();
        const [rows] = await pool.execute(
            `SELECT * FROM ${tableName('notification_preferences')}
             WHERE user_id = ?`,
            [userId]
        );
        return rows[0] || null;
    } catch (error) {
        console.error('[Database] Error getting preferences:', error.message);
        return null;
    }
}

/**
 * Close the database pool
 */
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

module.exports = {
    getPool,
    tableName,
    getPendingNotifications,
    markNotificationSent,
    markNotificationRead,
    getUnreadCount,
    getUserPreferences,
    closePool
};
