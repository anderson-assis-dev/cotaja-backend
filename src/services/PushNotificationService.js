const jwt = require('jsonwebtoken');
const https = require('https');
const fs = require('fs');
const path = require('path');
const apn = require('apn');

class PushNotificationService {
    constructor() {
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

        if (serviceAccount) {
            this.clientEmail = serviceAccount.client_email;
            this.privateKey = serviceAccount.private_key;
            this.projectId = serviceAccount.project_id;
        } else {
            this.clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-xxxx@cotaja.iam.gserviceaccount.com';
            this.privateKey = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;
            this.projectId = process.env.FIREBASE_PROJECT_ID || 'cotaja-pushnotification';
        }

        this.iosCertPath = process.env.IOS_CERT_PATH || './certificates/APNs_Certificate.pem';
        this.iosKeyPath = process.env.IOS_KEY_PATH || './certificates/APNs_PrivateKey.pem';
        this.appBundle = process.env.IOS_APP_BUNDLE || 'com.cotaja';

        this.accessToken = null;
        this.tokenExpiry = null;
    }

    
    async sendAlert(data) {
        try {
            if (!this.checkVar(data.registration_id) ||
                !this.checkVar(data.device) ||
                !this.checkVar(data.title) ||
                !this.checkVar(data.message)) {
                throw new Error('Missing required fields');
            }

            const { registration_id, device, title, message, sound, image_url, production, extra_data } = data;

            switch (device.toLowerCase()) {
                case 'ios':
                    return await this.sendIOS(registration_id, title, message, sound, image_url, production, extra_data);
                case 'android':
                    return await this.sendAndroid(registration_id, title, message, image_url, extra_data);
                default:
                    throw new Error('Invalid device type. Must be "ios" or "android"');
            }
        } catch (error) {
            console.error('Error sending push notification:', error);
            throw error;
        }
    }

    
    checkVar(variable) {
        return variable !== null &&
               variable !== undefined &&
               variable !== '' &&
               variable !== 'null' &&
               String(variable).toLowerCase() !== 'null';
    }

    
    async sendAndroid(registrationId, title, message, imageUrl = null, extraData = null) {
        try {
            const accessToken = await this.getAccessToken();
            const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;

            const notification = {
                title: title,
                body: message
            };

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

            if (extraData && typeof extraData === 'object') {
                const stringData = {};
                for (const [key, value] of Object.entries(extraData)) {
                    stringData[key] = String(value);
                }
                payload.message.data = stringData;
            }

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

    
    async sendIOS(registrationId, title, message, sound = 'default', imageUrl = null, production = false, extraData = null) {
        try {
            if (process.env.USE_FCM_FOR_IOS === 'true') {
                console.log('Using FCM for iOS notification');
                return await this.sendAndroid(registrationId, title, message, imageUrl, extraData);
            }

            if (!fs.existsSync(this.iosCertPath)) {
                throw new Error(`iOS certificate not found at: ${this.iosCertPath}. Consider setting USE_FCM_FOR_IOS=true in .env to use FCM instead.`);
            }
            if (!fs.existsSync(this.iosKeyPath)) {
                throw new Error(`iOS private key not found at: ${this.iosKeyPath}. Consider setting USE_FCM_FOR_IOS=true in .env to use FCM instead.`);
            }

            const result = await this._sendIOSWithFallback(registrationId, title, message, sound, imageUrl, production, extraData);
            return result;

        } catch (error) {
            console.error('❌ Error sending iOS notification:', error);
            console.error('Note: You may need a valid APNs Push Notification certificate, or set USE_FCM_FOR_IOS=true to use FCM');
            throw error;
        }
    }

    
    async _sendIOSWithFallback(registrationId, title, message, sound, imageUrl, startWithProduction = true, extraData = null) {
        const environments = startWithProduction ? ['production', 'sandbox'] : ['sandbox', 'production'];

        for (let i = 0; i < environments.length; i++) {
            const isProduction = environments[i] === 'production';
            const isLastAttempt = i === environments.length - 1;

            try {
                console.log(`📱 Sending iOS notification via ${isProduction ? 'PRODUCTION' : 'SANDBOX'} APNs`);
                console.log(`   Certificate: ${this.iosCertPath}`);
                console.log(`   Key: ${this.iosKeyPath}`);

                const apnProvider = new apn.Provider({
                    cert: this.iosCertPath,
                    key: this.iosKeyPath,
                    production: isProduction
                });

                const notification = new apn.Notification();
                notification.alert = {
                    title: title,
                    body: message
                };
                notification.badge = 1;
                notification.sound = sound || 'default';
                notification.topic = this.appBundle;

                if (imageUrl) {
                    notification.payload = { image: imageUrl };
                }

                if (extraData && typeof extraData === 'object') {
                    notification.payload = { ...(notification.payload || {}), ...extraData };
                }

                const result = await apnProvider.send(notification, registrationId);

                apnProvider.shutdown();

                if (result.failed && result.failed.length > 0) {
                    const error = result.failed[0];
                    console.error(`❌ APNs Error (${isProduction ? 'PRODUCTION' : 'SANDBOX'}):`, error.response);

                    if (error.response && error.response.reason === 'BadDeviceToken' && !isLastAttempt) {
                        console.log(`⚠️  BadDeviceToken in ${isProduction ? 'PRODUCTION' : 'SANDBOX'}, tentando ${isProduction ? 'SANDBOX' : 'PRODUCTION'}...`);
                        continue;
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
                if (isLastAttempt) {
                    throw error;
                }

                if (!error.message.includes('BadDeviceToken')) {
                    throw error;
                }

                console.log(`⚠️  Erro em ${isProduction ? 'PRODUCTION' : 'SANDBOX'}, tentando ${isProduction ? 'SANDBOX' : 'PRODUCTION'}...`);
            }
        }
    }

    
    async getAccessToken() {
        try {
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
                this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
                return this.accessToken;
            } else {
                throw new Error('Failed to retrieve access token: ' + response);
            }

        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    
    createJWT() {
        if (!this.privateKey) {
            throw new Error('Firebase private key not configured');
        }

        const payload = {
            iss: this.clientEmail,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    }

    
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
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.setTimeout(15000, () => {
                req.destroy(new Error('Push HTTP request timed out (15s)'));
            });

            req.on('error', reject);

            if (options.body) req.write(options.body);
            req.end();
        });
    }

    
    makeHttpsRequest(options, payload) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data || 'Success');
                    } else {
                        reject(new Error(`APNs HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.setTimeout(15000, () => {
                req.destroy(new Error('APNs request timed out (15s)'));
            });

            req.on('error', reject);

            if (payload) req.write(payload);
            req.end();
        });
    }

    
    async sendBulkNotifications(devices, title, message, options = {}) {
        console.log(`📤 [sendBulkNotifications] Enviando para ${devices.length} dispositivos em paralelo`);
        console.log(`   Título: ${title}`);
        console.log(`   Mensagem: ${message}`);

        const promises = devices.map((device, i) => {
            console.log(`📱 [${i + 1}/${devices.length}] Enfileirando:`, {
                name: device.name,
                platform: device.platform,
                token: device.token ? device.token.substring(0, 20) + '...' : 'AUSENTE'
            });

            return this.sendAlert({
                registration_id: device.token,
                device: device.platform,
                title: title,
                message: message,
                sound: options.sound || 'default',
                image_url: options.image_url,
                production: true,
                extra_data: options.data
            }).then(result => {
                console.log(`   ✅ Sucesso para ${device.name}`);
                return { device_id: device.id, success: true, result };
            }).catch(error => {
                console.error(`   ❌ Falha para ${device.name}:`, error.message);
                return { device_id: device.id, success: false, error: error.message };
            });
        });

        const results = await Promise.all(promises);

        console.log(`📊 [sendBulkNotifications] Resultado: ${results.filter(r => r.success).length} sucesso, ${results.filter(r => !r.success).length} falhas`);
        return results;
    }

    
    async sendToUser(userId, title, message, options = {}) {
        try {

            console.log(`Sending notification to user ${userId}: ${title} - ${message}`);
            return { success: true, message: 'Notification queued for user' };
        } catch (error) {
            console.error('Error sending notification to user:', error);
            throw error;
        }
    }
}

module.exports = PushNotificationService;