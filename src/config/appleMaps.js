// Apple Maps Configuration
// Uses MapKit JS / Apple Maps Server API for geocoding
const path = require('path');

module.exports = {
    // Apple Developer credentials
    teamId: process.env.APPLE_MAPS_TEAM_ID || 'B357A7B3RW',
    keyId: process.env.APPLE_MAPS_KEY_ID || 'GY47YU9BML',
    mapsId: process.env.APPLE_MAPS_ID || 'maps.tracking.nadav',

    // Path to the .p8 private key file
    privateKeyPath: process.env.APPLE_MAPS_KEY_PATH || path.join(__dirname, '../../certificates/AuthKey_GY47YU9BML.p8'),

    // Token expiry (max 1 year for MapKit JS, but we use shorter for security)
    tokenExpirySeconds: 3600, // 1 hour

    // Apple Maps Server API base URL
    serverApiBaseUrl: 'https://maps-api.apple.com',
};
