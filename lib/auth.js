/**
 * @copyright 2026 Alexander von Pidoll
 * All rights reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * in whole or in part, via any medium, is strictly prohibited.
 */

/**
 * Authentication Handler
 *
 * Validates WebSocket tokens against the PHP API.
 */

const config = require('../config');

/**
 * Validate a token and get user info
 *
 * @param {string} token - The WebSocket token
 * @returns {Promise<Object>} User info or error
 */
async function validateToken(token) {
    if (!token) {
        return { success: false, error: 'Token required' };
    }

    try {
        const url = `${config.api.baseUrl}${config.api.tokenValidationEndpoint}&token=${encodeURIComponent(token)}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Internal-Request': 'true',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[Auth] Token validation error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Middleware for Socket.io authentication
 *
 * @param {Socket} socket - Socket.io socket
 * @param {Function} next - Next middleware
 */
async function authMiddleware(socket, next) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
        return next(new Error('Authentication token required'));
    }

    const result = await validateToken(token);

    if (!result.success) {
        return next(new Error(result.error || 'Authentication failed'));
    }

    // Attach user info to socket
    socket.userId = result.user_id;
    socket.username = result.username;
    socket.displayName = result.display_name;
    socket.deviceId = result.device_id;

    next();
}

module.exports = {
    validateToken,
    authMiddleware
};
