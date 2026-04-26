const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ProviderRating=require('./ProviderRating');

class User {
    constructor(data = {}) {
        this.id = data.id || null;
        this.uuid = data.uuid || null;
        this.name = data.name || null;
        this.email = data.email || null;
        this.phone = data.phone || null;
        this.cpf = data.cpf || null;
        this.mother_name = data.mother_name || null;
        this.birth_date = data.birth_date || null;
        this.stripe_customer_id = data.stripe_customer_id || null;
        this.is_premium = data.is_premium !== undefined ? data.is_premium : 0;
        this.is_verified = data.is_verified !== undefined ? data.is_verified : 0;
        this.premium_since = data.premium_since || null;
        this.premium_until = data.premium_until || null;
        this.stripe_subscription_id = data.stripe_subscription_id || null;
        this.address = data.address || null;
        this.latitude = data.latitude || null;
        this.longitude = data.longitude || null;
        this.zip_code = data.zip_code || null;
        this.profile_type = data.profile_type || 'client';
        this.service_categories = data.service_categories || null;
        this.criminal_check = data.criminal_check !== undefined ? data.criminal_check : 0;
        this.criminal_check_code = data.criminal_check_code || null;
        this.criminal_check_date = data.criminal_check_date || null;
        this.fcm_token = data.fcm_token || null;
        this.device_platform = data.device_platform || null;
        this.password = data.password || null;
        this.email_verified_at = data.email_verified_at || null;
        this.remember_token = data.remember_token || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
        this.balance = data.balance || null;
        this.rate = data.rate || null;
        this.active_services = data.active_services || null;
        this.completed_services = data.completed_services || null;
        this.avatar_base64 = data.avatar_base64 || null;
        this.activate = data.activate !== undefined ? data.activate : 0;
        this.activation_token = data.activation_token || null;
        this.deleted_at = data.deleted_at || null;
    }

    static async create(userData) {
        const connection = await pool.getConnection();
        try {
            const uuid = crypto.randomUUID();

            const hashedPassword = await bcrypt.hash(userData.password, 10);

            const activationToken = crypto.randomUUID();

            const [result] = await connection.execute(
                `INSERT INTO users (uuid, name, email, phone, cpf, mother_name, birth_date, stripe_customer_id, password, profile_type, address, zip_code, latitude, longitude, service_categories, fcm_token, device_platform, activate, activation_token, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    uuid,
                    userData.name,
                    userData.email,
                    userData.phone || null,
                    userData.cpf || null,
                    userData.mother_name || null,
                    userData.birth_date || null,
                    userData.stripe_customer_id || null,
                    hashedPassword,
                    userData.profile_type || 'client',
                    userData.address || null,
                    userData.zip_code || null,
                    userData.latitude || null,
                    userData.longitude || null,
                    userData.service_categories ? JSON.stringify(userData.service_categories) : null,
                    userData.fcm_token || null,
                    userData.device_platform || null,
                    0,
                    activationToken
                ]
            );

            return await User.findById(result.insertId);
        } finally {
            connection.release();
        }
    }

    static async findById(id) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM users WHERE id = ?',
                [id]
            );

            if (rows.length === 0) return null;

            const userData = rows[0];
            if (userData.service_categories) {
                userData.service_categories = JSON.parse(userData.service_categories);
            }

            return new User(userData);
        } finally {
            connection.release();
        }
    }

    static async findByEmail(email) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            if (rows.length === 0) return null;

            const userData = rows[0];
            if (userData.service_categories) {
                userData.service_categories = JSON.parse(userData.service_categories);
            }

            return new User(userData);
        } finally {
            connection.release();
        }
    }

    static async findByActivationToken(token) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM users WHERE activation_token = ?',
                [token]
            );

            if (rows.length === 0) return null;

            const userData = rows[0];
            if (userData.service_categories) {
                userData.service_categories = JSON.parse(userData.service_categories);
            }

            return new User(userData);
        } finally {
            connection.release();
        }
    }

    static async findClients() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM users WHERE profile_type = ?',
                ['client']
            );

            return rows.map(userData => {
                if (userData.service_categories) {
                    userData.service_categories = JSON.parse(userData.service_categories);
                }
                return new User(userData);
            });
        } finally {
            connection.release();
        }
    }

    static async findProviders() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM users WHERE profile_type = ?',
                ['provider']
            );

            return rows.map(userData => {
                if (userData.service_categories) {
                    userData.service_categories = JSON.parse(userData.service_categories);
                }
                return new User(userData);
            });
        } finally {
            connection.release();
        }
    }

    static async findProvidersByCategory(category) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM users WHERE profile_type = ? AND JSON_CONTAINS(service_categories, ?)',
                ['provider', JSON.stringify(category)]
            );

            return rows.map(userData => {
                if (userData.service_categories) {
                    userData.service_categories = JSON.parse(userData.service_categories);
                }
                return new User(userData);
            });
        } finally {
            connection.release();
        }
    }


    static async getProviderTokens(category = null) {
        const connection = await pool.getConnection();
        try {
            let query = `
                SELECT id, fcm_token, device_platform, name, email
                FROM users
                WHERE profile_type = 'provider'
                AND fcm_token IS NOT NULL
                AND fcm_token != ''
            `;
            const params = [];

            if (category) {
                query += ' AND JSON_CONTAINS(service_categories, ?)';
                params.push(JSON.stringify(category));
            }

            console.log('🔍 [getProviderTokens] Query:', query);
            console.log('🔍 [getProviderTokens] Params:', params);

            const [rows] = await connection.execute(query, params);

            console.log(`📊 [getProviderTokens] Encontrados ${rows.length} providers com FCM token`);

            const result = rows.map(row => {
                console.log(`   - Provider ID ${row.id}: ${row.name} (${row.email}) - Platform: ${row.device_platform || 'ios'} - Token: ${row.fcm_token ? row.fcm_token.substring(0, 20) + '...' : 'AUSENTE'}`);
                return {
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    token: row.fcm_token,
                    platform: row.device_platform || 'ios'
                };
            });

            return result;
        } finally {
            connection.release();
        }
    }

    static async listProvidersPublic({ search = null } = {}) {
        const connection = await pool.getConnection();
        try {
            let query = `
                SELECT id, uuid, name, email, phone, address, profile_type, service_categories, avatar_base64, activate, created_at, updated_at
                FROM users
                WHERE profile_type = 'provider'
                AND activate = 1
            `;
            const params = [];
            if (search) {
                query += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(phone) LIKE ?)';
                const q = `%${String(search).toLowerCase()}%`;
                params.push(q, q, q);
            }
            query += ' ORDER BY created_at DESC';
            const [rows] = await connection.execute(query, params);
            return rows.map(row => {
                if (row.service_categories) {
                    try { row.service_categories = JSON.parse(row.service_categories); } catch (e) { row.service_categories = null; }
                }
                const user = new User(row);
                return user.toJSON();
            });
        } finally {
            connection.release();
        }
    }

    static async searchProviders({ category = null, city = null, limit = 20 } = {}) {
        const connection = await pool.getConnection();
        try {
            await ProviderRating.ensureTable();
            let query = `
                SELECT u.uuid, u.name, u.address, u.zip_code, u.service_categories,
                       u.avatar_base64, COALESCE(pr.avg_rating,0) rate
                FROM users u
                LEFT JOIN (
                    SELECT provider_id,AVG(rating) avg_rating
                    FROM provider_ratings
                    GROUP BY provider_id
                ) pr ON pr.provider_id=u.id
                WHERE u.profile_type = 'provider'
                AND u.activate = 1
            `;
            const params = [];

            if (category) {
                query += ' AND JSON_CONTAINS(LOWER(u.service_categories), ?)';
                params.push(JSON.stringify(category.toLowerCase()));
            }

            if (city) {
                query += ' AND LOWER(u.address) LIKE ?';
                params.push(`%${city.toLowerCase()}%`);
            }

            query += ' ORDER BY rate DESC, u.name ASC LIMIT ?';
            params.push(limit);

            const [rows] = await connection.execute(query, params);
            return rows.map(row => {
                if (row.service_categories) {
                    try { row.service_categories = JSON.parse(row.service_categories); } catch { row.service_categories = []; }
                }
                return row;
            });
        } finally {
            connection.release();
        }
    }

    async update(updateData) {
        const connection = await pool.getConnection();
        try {
            const fields = [];
            const values = [];

            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined && key !== 'id') {
                    fields.push(`${key} = ?`);
                    if (key === 'service_categories' && updateData[key]) {
                        values.push(JSON.stringify(updateData[key]));
                    } else {
                        values.push(updateData[key]);
                    }
                }
            });

            if (fields.length === 0) return this;

            fields.push('updated_at = NOW()');
            values.push(this.id);

            await connection.execute(
                `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    this[key] = updateData[key];
                }
            });

            return this;
        } finally {
            connection.release();
        }
    }

    async save() {
        if (this.id) {
            return await this.update(this.toObject());
        } else {
            const created = await User.create(this.toObject());
            Object.assign(this, created);
            return this;
        }
    }

    async delete() {
        if (!this.id) return false;

        const connection = await pool.getConnection();
        try {
            await connection.execute('DELETE FROM users WHERE id = ?', [this.id]);
            return true;
        } finally {
            connection.release();
        }
    }

    async softDelete() {
        if (!this.id) return false;

        const connection = await pool.getConnection();
        try {
            // Obfuscate email to free it for future re-registration
            const obfuscatedEmail = `deleted_${this.id}@deleted.invalid`;
            await connection.execute(
                'UPDATE users SET deleted_at = NOW(), email = ?, updated_at = NOW() WHERE id = ?',
                [obfuscatedEmail, this.id]
            );
            this.deleted_at = new Date();
            this.email = obfuscatedEmail;
            return true;
        } finally {
            connection.release();
        }
    }

    async verifyPassword(password) {
        return await bcrypt.compare(password, this.password);
    }

    isClient() {
        return this.profile_type === 'client';
    }

    isProvider() {
        return this.profile_type === 'provider';
    }

    providesCategory(category) {
        if (!this.isProvider() || !this.service_categories) {
            return false;
        }

        return this.service_categories.includes(category);
    }

    toObject() {
        const obj = { ...this };
        delete obj.password;
        return obj;
    }

    toJSON() {
        const obj = this.toObject();
        delete obj.remember_token;
        delete obj.activation_token;
        return obj;
    }
}

module.exports = User;