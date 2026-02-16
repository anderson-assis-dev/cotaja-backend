const { pool } = require('../config/database');
const moment = require('moment');

class Order {
    constructor(data = {}) {
        this.id = data.id || null;
        this.title = data.title || null;
        this.description = data.description || null;
        this.category = data.category || null;
        this.budget = data.budget || null;
        this.deadline = data.deadline || null;
        this.address = data.address || null;
        this.status = data.status || 'open';
        this.client_id = data.client_id || null;
        this.provider_id = data.provider_id || null;
        this.accepted_proposal_id = data.accepted_proposal_id || null;
        this.auction_started_at = data.auction_started_at || null;
        this.auction_ends_at = data.auction_ends_at || null;
        // MySQL JSON columns may return as string — ensure it's parsed
        if (typeof data.attachments === 'string') {
            try {
                this.attachments = JSON.parse(data.attachments);
            } catch (e) {
                this.attachments = null;
            }
        } else {
            this.attachments = data.attachments || null;
        }
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;

        // Initialize relations as empty arrays
        this.proposals = [];
        this.client = null;
        this.provider = null;
    }

    static get STATUS_OPEN() { return 'open'; }
    static get STATUS_IN_PROGRESS() { return 'in_progress'; }
    static get STATUS_COMPLETED() { return 'completed'; }
    static get STATUS_CANCELLED() { return 'cancelled'; }

    static async create(orderData) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO orders (title, description, category, budget, deadline, address, status, client_id, provider_id, accepted_proposal_id, auction_started_at, auction_ends_at, attachments, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    orderData.title,
                    orderData.description,
                    orderData.category,
                    orderData.budget,
                    orderData.deadline,
                    orderData.address,
                    orderData.status || Order.STATUS_OPEN,
                    orderData.client_id,
                    orderData.provider_id || null,
                    orderData.accepted_proposal_id || null,
                    orderData.auction_started_at || null,
                    orderData.auction_ends_at || null,
                    orderData.attachments || null
                ]
            );

            return await Order.findById(result.insertId);
        } finally {
            connection.release();
        }
    }

    static async findById(id, withRelations = false) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM orders WHERE id = ?';
            const [rows] = await connection.execute(query, [id]);

            if (rows.length === 0) return null;

            const order = new Order(rows[0]);

            if (withRelations) {
                await order.loadRelations(connection);
            }

            return order;
        } finally {
            connection.release();
        }
    }

    static async findByClient(clientId, options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM orders WHERE client_id = ?';
            const params = [clientId];

            if (options.status) {
                query += ' AND status = ?';
                params.push(options.status);
            }

            if (options.category) {
                query += ' AND category = ?';
                params.push(options.category);
            }

            query += ' ORDER BY created_at DESC';

            if (options.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

            const [rows] = await connection.execute(query, params);

            const orders = rows.map(row => new Order(row));

            if (options.withRelations) {
                for (const order of orders) {
                    await order.loadRelations(connection);
                }
            }

            return orders;
        } finally {
            connection.release();
        }
    }

    static async findByProvider(providerId, options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM orders WHERE provider_id = ?';
            const params = [providerId];

            if (options.status) {
                query += ' AND status = ?';
                params.push(options.status);
            }

            if (options.category) {
                query += ' AND category = ?';
                params.push(options.category);
            }

            query += ' ORDER BY created_at DESC';

            if (options.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

            const [rows] = await connection.execute(query, params);

            const orders = rows.map(row => new Order(row));

            if (options.withRelations) {
                for (const order of orders) {
                    await order.loadRelations(connection);
                }
            }

            return orders;
        } finally {
            connection.release();
        }
    }

    static async findOpen(options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM orders WHERE status = ?';
            const params = [Order.STATUS_OPEN];

            if (options.category) {
                query += ' AND category = ?';
                params.push(options.category);
            }

            if (options.cep) {
                const cep = options.cep.replace(/[^0-9]/g, '');
                if (cep.length >= 5) {
                    const cepPrefix = cep.substring(0, 5);
                    query += ' AND (address LIKE ? OR address LIKE ?)';
                    params.push(`%${cep}%`, `%${cepPrefix}%`);
                }
            }

            query += ' ORDER BY created_at DESC';

            if (options.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

            const [rows] = await connection.execute(query, params);

            const orders = rows.map(row => new Order(row));

            if (options.withRelations) {
                for (const order of orders) {
                    await order.loadRelations(connection);
                }
            }

            return orders;
        } finally {
            connection.release();
        }
    }

    static async findRecent(clientId, days = 30, limit = 5) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM orders
                 WHERE client_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [clientId, days, limit]
            );

            const orders = rows.map(row => new Order(row));

            for (const order of orders) {
                await order.loadRelations(connection);
            }

            return orders;
        } finally {
            connection.release();
        }
    }

    static async getClientStats(clientId) {
        const connection = await pool.getConnection();
        try {
            const [totalRows] = await connection.execute(
                'SELECT COUNT(*) as total_orders FROM orders WHERE client_id = ?',
                [clientId]
            );

            const [openRows] = await connection.execute(
                'SELECT COUNT(*) as open_orders FROM orders WHERE client_id = ? AND status = ?',
                [clientId, Order.STATUS_OPEN]
            );

            const [completedRows] = await connection.execute(
                'SELECT COUNT(*) as completed_orders FROM orders WHERE client_id = ? AND status = ?',
                [clientId, Order.STATUS_COMPLETED]
            );

            const [spentRows] = await connection.execute(
                'SELECT SUM(budget) as total_spent FROM orders WHERE client_id = ? AND status = ?',
                [clientId, Order.STATUS_COMPLETED]
            );

            return {
                total_orders: totalRows[0].total_orders,
                open_orders: openRows[0].open_orders,
                completed_orders: completedRows[0].completed_orders,
                total_spent: spentRows[0].total_spent || 0
            };
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
                    values.push(updateData[key]);
                }
            });

            if (fields.length === 0) return this;

            fields.push('updated_at = NOW()');
            values.push(this.id);

            await connection.execute(
                `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            // Update current instance
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

    async delete() {
        if (!this.id) return false;

        const connection = await pool.getConnection();
        try {
            await connection.execute('DELETE FROM orders WHERE id = ?', [this.id]);
            return true;
        } finally {
            connection.release();
        }
    }

    async loadRelations(connection = null) {
        const shouldCloseConnection = !connection;
        if (!connection) {
            connection = await pool.getConnection();
        }

        try {
            // Load client
            if (this.client_id) {
                const [clientRows] = await connection.execute(
                    'SELECT id, name, email, phone, profile_type, avatar_base64 FROM users WHERE id = ?',
                    [this.client_id]
                );
                this.client = clientRows[0] || null;
            }

            // Load provider
            if (this.provider_id) {
                const [providerRows] = await connection.execute(
                    'SELECT id, name, email, phone, profile_type, avatar_base64 FROM users WHERE id = ?',
                    [this.provider_id]
                );
                this.provider = providerRows[0] || null;
            }

            // Load proposals
            const [proposalRows] = await connection.execute(
                'SELECT p.*, u.name as provider_name, u.email as provider_email, u.avatar_base64 as provider_avatar_base64 FROM proposals p LEFT JOIN users u ON p.provider_id = u.id WHERE p.order_id = ?',
                [this.id]
            );
            this.proposals = proposalRows;
        } finally {
            if (shouldCloseConnection) {
                connection.release();
            }
        }
    }

    isAuctionActive() {
        return this.auction_started_at &&
               this.auction_ends_at &&
               moment().isBetween(moment(this.auction_started_at), moment(this.auction_ends_at));
    }

    isAuctionExpired() {
        return this.auction_ends_at && moment().isAfter(moment(this.auction_ends_at));
    }

    canStartAuction() {
        return this.status === Order.STATUS_OPEN && !this.auction_started_at;
    }

    getAuctionTimeRemaining() {
        if (!this.auction_ends_at) {
            return null;
        }

        const now = moment();
        const endTime = moment(this.auction_ends_at);

        if (now.isAfter(endTime)) {
            return 'Expirado';
        }

        const duration = moment.duration(endTime.diff(now));

        if (duration.days() > 0) {
            return duration.days() + ' dia' + (duration.days() > 1 ? 's' : '');
        }

        if (duration.hours() > 0) {
            return duration.hours() + ' hora' + (duration.hours() > 1 ? 's' : '');
        }

        return duration.minutes() + ' minuto' + (duration.minutes() > 1 ? 's' : '');
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            category: this.category,
            budget: this.budget,
            deadline: this.deadline,
            address: this.address,
            status: this.status,
            client_id: this.client_id,
            provider_id: this.provider_id,
            accepted_proposal_id: this.accepted_proposal_id,
            auction_started_at: this.auction_started_at,
            auction_ends_at: this.auction_ends_at,
            attachments: this.attachments,
            created_at: this.created_at,
            updated_at: this.updated_at,
            proposals: this.proposals || [],
            client: this.client,
            provider: this.provider,
        };
    }
}

module.exports = Order;