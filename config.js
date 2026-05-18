/**
 * @copyright 2026 Alexander von Pidoll
 * All rights reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * in whole or in part, via any medium, is strictly prohibited.
 */

/**
 * WebSocket Server Configuration
 */

require('dotenv').config();

module.exports = {
    // Server settings
    port: process.env.WS_PORT || 3001,
    host: process.env.WS_HOST || '0.0.0.0',

    // CORS settings
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    },

    // Database settings (MySQL)
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'framework',
        tablePrefix: process.env.DB_PREFIX || 'fw_'
    },

    // PHP API settings (for token validation)
    api: {
        baseUrl: process.env.API_URL || 'http://localhost/framework',
        tokenValidationEndpoint: '/api/websocket-token.php?action=validate'
    },

    // Connection settings
    connection: {
        pingInterval: 25000,
        pingTimeout: 60000
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        console: true
    }
};
