const { pool } = require('../config/database');

class Notification {
    constructor(data = {}) {
        this.id = data.id || null;
        this.user_id = data.user_id || null;
        this.type = data.type || null;
        this.title = data.title || null;
        this.message = data.message || null;
        this.data = data.data || null;
        this.read_at = data.read_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    static get TYPE_NEW_ORDER() { return 'new_order'; }
    static get TYPE_NEW_PROPOSAL() { return 'new_proposal'; }
    static get TYPE_PROPOSAL_ACCEPTED() { return 'proposal_accepted'; }
    static get TYPE_PROPOSAL_REJECTED() { return 'proposal_rejected'; }

    static async create(notificationData) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO notifications (user_id, type, title, message, data, read_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    notificationData.user_id,
                    notificationData.type,
                    notificationData.title,
                    notificationData.message,
                    notificationData.data ? JSON.stringify(notificationData.data) : null,
                    notificationData.read_at || null
                ]
            );

            return await Notification.findById(result.insertId);
        } finally {
            connection.release();
        }
    }

    static async findById(id) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM notifications WHERE id = ?',
                [id]
            );

            if (rows.length === 0) return null;

            const notificationData = rows[0];
            if (notificationData.data) {
                notificationData.data = JSON.parse(notificationData.data);
            }

            return new Notification(notificationData);
        } finally {
            connection.release();
        }
    }

    static async findByUser(userId, options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM notifications WHERE user_id = ?';
            const params = [userId];

            if (options.type) {
                query += ' AND type = ?';
                params.push(options.type);
            }

            if (options.unread === true) {
                query += ' AND read_at IS NULL';
            } else if (options.read === true) {
                query += ' AND read_at IS NOT NULL';
            }

            query += ' ORDER BY created_at DESC';

            if (options.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

            const [rows] = await connection.execute(query, params);

            return rows.map(row => {
                if (row.data) {
                    row.data = JSON.parse(row.data);
                }
                return new Notification(row);
            });
        } finally {
            connection.release();
        }
    }

    static async findUnread(userId, options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM notifications WHERE user_id = ? AND read_at IS NULL';
            const params = [userId];

            if (options.type) {
                query += ' AND type = ?';
                params.push(options.type);
            }

            query += ' ORDER BY created_at DESC';

            if (options.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

            const [rows] = await connection.execute(query, params);

            return rows.map(row => {
                if (row.data) {
                    row.data = JSON.parse(row.data);
                }
                return new Notification(row);
            });
        } finally {
            connection.release();
        }
    }

    static async getUnreadCount(userId) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND read_at IS NULL',
                [userId]
            );

            return rows[0].unread_count;
        } finally {
            connection.release();
        }
    }

    static async markAllAsRead(userId) {
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'UPDATE notifications SET read_at = NOW(), updated_at = NOW() WHERE user_id = ? AND read_at IS NULL',
                [userId]
            );

            return true;
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
                    if (key === 'data' && updateData[key]) {
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
                `UPDATE notifications SET ${fields.join(', ')} WHERE id = ?`,
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

    async markAsRead() {
        return await this.update({ read_at: new Date() });
    }

    async delete() {
        if (!this.id) return false;

        const connection = await pool.getConnection();
        try {
            await connection.execute('DELETE FROM notifications WHERE id = ?', [this.id]);
            return true;
        } finally {
            connection.release();
        }
    }

    isRead() {
        return this.read_at !== null;
    }

    toJSON() {
        return { ...this };
    }
}

module.exports = Notification;