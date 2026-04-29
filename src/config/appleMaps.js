const path = require('path');

module.exports = {
    teamId: process.env.APPLE_MAPS_TEAM_ID,
    keyId: process.env.APPLE_MAPS_KEY_ID,
    mapsId: process.env.APPLE_MAPS_ID,

    privateKeyPath: process.env.APPLE_MAPS_KEY_PATH,

    tokenExpirySeconds: 3600,

    serverApiBaseUrl: 'https://maps-api.apple.com',
};
