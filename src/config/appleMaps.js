const path = require('path');

module.exports = {
    teamId: process.env.APPLE_MAPS_TEAM_ID || 'B357A7B3RW',
    keyId: process.env.APPLE_MAPS_KEY_ID || 'GY47YU9BML',
    mapsId: process.env.APPLE_MAPS_ID || 'maps.tracking.nadav',

    privateKeyPath: process.env.APPLE_MAPS_KEY_PATH || path.join(__dirname, '../../certificates/AuthKey_GY47YU9BML.p8'),

    tokenExpirySeconds: 3600,

    serverApiBaseUrl: 'https://maps-api.apple.com',
};
