const { pool } = require('../config/database');

class Message {
    constructor(data = {}) {
        this.id = data.id || null;
        this.order_id = data.order_id || null;
        this.sender_id = data.sender_id || null;
        this.receiver_id = data.receiver_id || null;
        this.content = data.content || null;
        this.read_at = data.read_at || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;

        this.sender = data.sender || null;
        this.receiver = data.receiver || null;
    }

    static async create(data) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO messages (order_id, sender_id, receiver_id, content, created_at, updated_at)
                 VALUES (?, ?, ?, ?, NOW(), NOW())`,
                [data.order_id, data.sender_id, data.receiver_id, data.content]
            );
            return await Message.findById(result.insertId);
        } finally {
            connection.release();
        }
    }

    static async findById(id) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT m.*,
                    s.name as sender_name, s.avatar_base64 as sender_avatar,
                    r.name as receiver_name, r.avatar_base64 as receiver_avatar
                 FROM messages m
                 LEFT JOIN users s ON m.sender_id = s.id
                 LEFT JOIN users r ON m.receiver_id = r.id
                 WHERE m.id = ?`,
                [id]
            );
            if (rows.length === 0) return null;

            const msg = new Message(rows[0]);
            msg.sender = { id: rows[0].sender_id, name: rows[0].sender_name, avatar_base64: rows[0].sender_avatar };
            msg.receiver = { id: rows[0].receiver_id, name: rows[0].receiver_name, avatar_base64: rows[0].receiver_avatar };
            return msg;
        } finally {
            connection.release();
        }
    }

    static async findByOrder(orderId, { page = 1, limit = 50 } = {}) {
        const connection = await pool.getConnection();
        try {
            const offset = (page - 1) * limit;

            const [countRows] = await connection.execute(
                'SELECT COUNT(*) as total FROM messages WHERE order_id = ?',
                [orderId]
            );
            const total = countRows[0].total;

            const [rows] = await connection.execute(
                `SELECT m.*,
                    s.name as sender_name, s.avatar_base64 as sender_avatar,
                    r.name as receiver_name, r.avatar_base64 as receiver_avatar
                 FROM messages m
                 LEFT JOIN users s ON m.sender_id = s.id
                 LEFT JOIN users r ON m.receiver_id = r.id
                 WHERE m.order_id = ?
                 ORDER BY m.created_at ASC
                 LIMIT ? OFFSET ?`,
                [orderId, limit, offset]
            );

            const messages = rows.map(row => {
                const msg = new Message(row);
                msg.sender = { id: row.sender_id, name: row.sender_name, avatar_base64: row.sender_avatar };
                msg.receiver = { id: row.receiver_id, name: row.receiver_name, avatar_base64: row.receiver_avatar };
                return msg;
            });

            return { messages, total, page, limit };
        } finally {
            connection.release();
        }
    }

    static async markAsRead(orderId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.execute(
                `UPDATE messages SET read_at = NOW() WHERE order_id = ? AND receiver_id = ? AND read_at IS NULL`,
                [orderId, userId]
            );
        } finally {
            connection.release();
        }
    }

    static async getUnreadCount(orderId, userId) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT COUNT(*) as count FROM messages WHERE order_id = ? AND receiver_id = ? AND read_at IS NULL`,
                [orderId, userId]
            );
            return rows[0].count;
        } finally {
            connection.release();
        }
    }
}

module.exports = Message;
