const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');
const apn = require('apn');

class PushNotificationService {
    constructor() {
        // Load Firebase Service Account from JSON file
        const serviceAccountPath = process.env.FIREBASE_PRIVATE_KEY_PATH || './certificates/firebase-service-account.json';
        let serviceAccount = null;

        try {
            const fullPath = path.resolve(__dirname, '../../', serviceAccountPath);
            if (fs.existsSync(fullPath)) {
                serviceAccount = require(fullPath);
                console.log('✅ Firebase Service Account loaded successfully');
            } else {
                console.log('⚠️  Firebase Service Account file not found:', fullPath);
            }
        } catch (error) {
            console.log('⚠️  Error loading Firebase Service Account:', error.message);
        }

        // Firebase configuration
        if (serviceAccount) {
            this.clientEmail = serviceAccount.client_email;
            this.privateKey = serviceAccount.private_key;
            this.projectId = serviceAccount.project_id;
        } else {
            // Fallback to environment variables
            this.clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-xxxx@cotaja.iam.gserviceaccount.com';
            this.privateKey = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;
            this.projectId = process.env.FIREBASE_PROJECT_ID || 'cotaja-pushnotification';
        }

        // iOS configuration
        this.iosCertPath = process.env.IOS_CERT_PATH || './certificates/APNs_Certificate.pem';
        this.iosKeyPath = process.env.IOS_KEY_PATH || './certificates/APNs_PrivateKey.pem';
        this.appBundle = process.env.IOS_APP_BUNDLE || 'com.cotaja';

        // Cache for access token
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Send push notification
     * @param {Object} data - Notification data
     * @param {string} data.registration_id - Device token
     * @param {string} data.device - 'ios' or 'android'
     * @param {string} data.title - Notification title
     * @param {string} data.message - Notification message
     * @param {string} data.sound - Sound file (optional)
     * @param {string} data.image_url - Image URL (optional)
     * @param {boolean} data.production - Use production environment (default: false)
     */
    async sendAlert(data) {
        try {
            // Validate required fields
            if (!this.checkVar(data.registration_id) ||
                !this.checkVar(data.device) ||
                !this.checkVar(data.title) ||
                !this.checkVar(data.message)) {
                throw new Error('Missing required fields');
            }

            const { registration_id, device, title, message, sound, image_url, production } = data;

            switch (device.toLowerCase()) {
                case 'ios':
                    return await this.sendIOS(registration_id, title, message, sound, image_url, production);
                case 'android':
                    return await this.sendAndroid(registration_id, title, message, image_url);
                default:
                    throw new Error('Invalid device type. Must be "ios" or "android"');
            }
        } catch (error) {
            console.error('Error sending push notification:', error);
            throw error;
        }
    }

    /**
     * Check if variable is valid (not null, empty, or string 'null')
     */
    checkVar(variable) {
        return variable !== null &&
               variable !== undefined &&
               variable !== '' &&
               variable !== 'null' &&
               String(variable).toLowerCase() !== 'null';
    }

    /**
     * Send Android push notification via FCM
     */
    async sendAndroid(registrationId, title, message, imageUrl = null) {
        try {
            const accessToken = await this.getAccessToken();
            const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

            // Create notification payload
            const notification = {
                title: title,
                body: message
            };

            // Add image if provided
            if (imageUrl) {
                notification.image = imageUrl;
            }

            const payload = {
                message: {
                    token: registrationId,
                    notification: notification,
                    android: {
                        priority: 'HIGH'
                    }
                }
            };

            const response = await this.makeHttpRequest(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log('Android notification sent successfully:', response);
            return { success: true, response };

        } catch (error) {
            console.error('Error sending Android notification:', error);
            throw error;
        }
    }

    /**
     * Send iOS push notification via APNs
     * @param {boolean} production - Use production certificate (default: false for sandbox)
     */
    async sendIOS(registrationId, title, message, sound = 'default', imageUrl = null, production = false) {
        try {
            // Check if using FCM for iOS (recommended)
            if (process.env.USE_FCM_FOR_IOS === 'true') {
                console.log('Using FCM for iOS notification');
                return await this.sendAndroid(registrationId, title, message, imageUrl);
            }

            // Check if certificate and key exist
            if (!fs.existsSync(this.iosCertPath)) {
                throw new Error(`iOS certificate not found at: ${this.iosCertPath}. Consider setting USE_FCM_FOR_IOS=true in .env to use FCM instead.`);
            }
            if (!fs.existsSync(this.iosKeyPath)) {
                throw new Error(`iOS private key not found at: ${this.iosKeyPath}. Consider setting USE_FCM_FOR_IOS=true in .env to use FCM instead.`);
            }

            // Try sending via APNs (sandbox first, then production if it fails)
            const result = await this._sendIOSWithFallback(registrationId, title, message, sound, imageUrl, production);
            return result;

        } catch (error) {
            console.error('❌ Error sending iOS notification:', error);
            console.error('Note: You may need a valid APNs Push Notification certificate, or set USE_FCM_FOR_IOS=true to use FCM');
            throw error;
        }
    }

    /**
     * Internal method to send iOS notification with automatic fallback from sandbox to production
     */
    async _sendIOSWithFallback(registrationId, title, message, sound, imageUrl, startWithProduction = false) {
        const environments = startWithProduction ? ['production', 'sandbox'] : ['sandbox', 'production'];

        for (let i = 0; i < environments.length; i++) {
            const isProduction = environments[i] === 'production';
            const isLastAttempt = i === environments.length - 1;

            try {
                console.log(`📱 Sending iOS notification via ${isProduction ? 'PRODUCTION' : 'SANDBOX'} APNs`);
                console.log(`   Certificate: ${this.iosCertPath}`);
                console.log(`   Key: ${this.iosKeyPath}`);

                // Configure APNs provider
                const apnProvider = new apn.Provider({
                    cert: this.iosCertPath,
                    key: this.iosKeyPath,
                    production: isProduction
                });

                // Create notification
                const notification = new apn.Notification();
                notification.alert = {
                    title: title,
                    body: message
                };
                notification.badge = 1;
                notification.sound = sound || 'default';
                notification.topic = this.appBundle;

                // Add image if provided
                if (imageUrl) {
                    notification.payload = { image: imageUrl };
                }

                // Send notification
                const result = await apnProvider.send(notification, registrationId);

                // Shutdown provider
                apnProvider.shutdown();

                // Check for errors
                if (result.failed && result.failed.length > 0) {
                    const error = result.failed[0];
                    console.error(`❌ APNs Error (${isProduction ? 'PRODUCTION' : 'SANDBOX'}):`, error.response);

                    // If BadDeviceToken and not the last attempt, try the other environment
                    if (error.response && error.response.reason === 'BadDeviceToken' && !isLastAttempt) {
                        console.log(`⚠️  BadDeviceToken in ${isProduction ? 'PRODUCTION' : 'SANDBOX'}, tentando ${isProduction ? 'SANDBOX' : 'PRODUCTION'}...`);
                        continue; // Try next environment
                    }

                    throw new Error(`APNs Error: ${error.response.reason || 'Unknown error'}`);
                }

                console.log('✅ iOS notification sent successfully');
                console.log(`   Sent: ${result.sent.length}, Failed: ${result.failed.length}`);
                console.log(`   Environment: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);

                return {
                    success: true,
                    sent: result.sent.length,
                    failed: result.failed.length,
                    environment: isProduction ? 'production' : 'sandbox'
                };

            } catch (error) {
                // If it's the last attempt, throw the error
                if (isLastAttempt) {
                    throw error;
                }

                // If it's not a BadDeviceToken error, throw immediately
                if (!error.message.includes('BadDeviceToken')) {
                    throw error;
                }

                // Otherwise, continue to next environment
                console.log(`⚠️  Erro em ${isProduction ? 'PRODUCTION' : 'SANDBOX'}, tentando ${isProduction ? 'SANDBOX' : 'PRODUCTION'}...`);
            }
        }
    }

    /**
     * Get Firebase access token
     */
    async getAccessToken() {
        try {
            // Return cached token if still valid
            if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.accessToken;
            }

            const jwtToken = this.createJWT();
            const url = 'https://oauth2.googleapis.com/token';

            const postData = new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwtToken
            }).toString();

            const response = await this.makeHttpRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: postData
            });

            const data = JSON.parse(response);

            if (data.access_token) {
                this.accessToken = data.access_token;
                this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early
                return this.accessToken;
            } else {
                throw new Error('Failed to retrieve access token: ' + response);
            }

        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    /**
     * Create JWT for Firebase authentication
     */
    createJWT() {
        if (!this.privateKey) {
            throw new Error('Firebase private key not configured');
        }

        const payload = {
            iss: this.clientEmail,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    }

    /**
     * Make HTTP request using Node.js native modules
     */
    makeHttpRequest(url, options) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            };

            const protocol = urlObj.protocol === 'https:' ? https : require('http');
            const req = protocol.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (options.body) {
                req.write(options.body);
            }

            req.end();
        });
    }

    /**
     * Make HTTPS request for iOS APNs
     */
    makeHttpsRequest(options, payload) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data || 'Success');
                    } else {
                        reject(new Error(`APNs HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (payload) {
                req.write(payload);
            }

            req.end();
        });
    }

    /**
     * Send notification to multiple devices
     */
    async sendBulkNotifications(devices, title, message, options = {}) {
        console.log(`📤 [sendBulkNotifications] Enviando para ${devices.length} dispositivos`);
        console.log(`   Título: ${title}`);
        console.log(`   Mensagem: ${message}`);

        const results = [];

        for (let i = 0; i < devices.length; i++) {
            const device = devices[i];
            console.log(`📱 [${i + 1}/${devices.length}] Enviando para:`, {
                name: device.name,
                email: device.email,
                platform: device.platform,
                token: device.token ? device.token.substring(0, 20) + '...' : 'AUSENTE'
            });

            try {
                const result = await this.sendAlert({
                    registration_id: device.token,
                    device: device.platform,
                    title: title,
                    message: message,
                    sound: options.sound || 'default',
                    image_url: options.image_url,
                    ...options.data
                });

                console.log(`   ✅ Sucesso para ${device.name}`);
                results.push({
                    device_id: device.id,
                    success: true,
                    result: result
                });
            } catch (error) {
                console.error(`   ❌ Falha para ${device.name}:`, error.message);
                results.push({
                    device_id: device.id,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log(`📊 [sendBulkNotifications] Resultado: ${results.filter(r => r.success).length} sucesso, ${results.filter(r => !r.success).length} falhas`);
        return results;
    }

    /**
     * Send notification to specific user (all their devices)
     */
    async sendToUser(userId, title, message, options = {}) {
        try {
            // You'll need to implement getting user devices from your database
            // const userDevices = await this.getUserDevices(userId);
            // return await this.sendBulkNotifications(userDevices, title, message, options);

            console.log(`Sending notification to user ${userId}: ${title} - ${message}`);
            // Placeholder - implement based on your user device storage
            return { success: true, message: 'Notification queued for user' };
        } catch (error) {
            console.error('Error sending notification to user:', error);
            throw error;
        }
    }
}

module.exports = PushNotificationService;