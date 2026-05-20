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

    // CORS settings — supports multiple frameworks sharing one WS server.
    // Set CORS_ORIGIN to a comma-separated list:
    //   CORS_ORIGIN=https://site-a.example.com,https://site-b.example.com
    // Single value or "*" still works exactly as before.
    cors: {
        origin: (function() {
            const raw = process.env.CORS_ORIGIN || '*';
            if (raw === '*') return '*';
            const list = raw.split(',').map(s => s.trim()).filter(Boolean);
            return list.length > 1 ? list : (list[0] || '*');
        })(),
        methods: ['GET', 'POST'],
        credentials: true
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
        tokenValidationEndpoint: '/api/websocket-token.php?action=validate',
        // SECURITY: shared secret for the internal token-validate endpoint.
        // Read from data/.ws-internal-secret on the framework host (generated
        // automatically on first PHP call). Mount that file or set the env var
        // explicitly. Without it the PHP side falls back to a loopback-only
        // check on the legacy X-Internal-Request header.
        internalSecret: process.env.WS_INTERNAL_SECRET || ''
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
