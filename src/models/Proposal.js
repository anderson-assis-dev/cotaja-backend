const { pool } = require('../config/database');

class Proposal {
    constructor(data = {}) {
        this.id = data.id || null;
        this.price = data.price || null;
        this.deadline = data.deadline || null;
        this.description = data.description || null;
        this.status = data.status || 'pending';
        this.order_id = data.order_id || null;
        this.provider_id = data.provider_id || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    static get STATUS_PENDING() { return 'pending'; }
    static get STATUS_ACCEPTED() { return 'accepted'; }
    static get STATUS_REJECTED() { return 'rejected'; }
    static get STATUS_WITHDRAWN() { return 'withdrawn'; }

    static async create(proposalData) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                `INSERT INTO proposals (price, deadline, description, status, order_id, provider_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    proposalData.price,
                    proposalData.deadline,
                    proposalData.description,
                    proposalData.status || Proposal.STATUS_PENDING,
                    proposalData.order_id,
                    proposalData.provider_id
                ]
            );

            return await Proposal.findById(result.insertId);
        } finally {
            connection.release();
        }
    }

    static async findById(id, withRelations = false) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM proposals WHERE id = ?',
                [id]
            );

            if (rows.length === 0) return null;

            const proposal = new Proposal(rows[0]);

            if (withRelations) {
                await proposal.loadRelations(connection);
            }

            return proposal;
        } finally {
            connection.release();
        }
    }

    static async findByOrder(orderId, options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM proposals WHERE order_id = ?';
            const params = [orderId];

            if (options.provider_id) {
                query += ' AND provider_id = ?';
                params.push(options.provider_id);
            }

            if (options.status) {
                query += ' AND status = ?';
                params.push(options.status);
            }

            query += ' ORDER BY created_at DESC';

            const [rows] = await connection.execute(query, params);

            const proposals = rows.map(row => new Proposal(row));

            if (options.withRelations) {
                for (const proposal of proposals) {
                    await proposal.loadRelations(connection);
                }
            }

            return proposals;
        } finally {
            connection.release();
        }
    }

    static async findByProvider(providerId, options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM proposals WHERE provider_id = ?';
            const params = [providerId];

            if (options.status) {
                query += ' AND status = ?';
                params.push(options.status);
            }

            query += ' ORDER BY created_at DESC';

            if (options.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

            const [rows] = await connection.execute(query, params);

            const proposals = rows.map(row => new Proposal(row));

            if (options.withRelations) {
                for (const proposal of proposals) {
                    await proposal.loadRelations(connection);
                }
            }

            return proposals;
        } finally {
            connection.release();
        }
    }

    static async findPending(options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM proposals WHERE status = ?';
            const params = [Proposal.STATUS_PENDING];

            if (options.order_id) {
                query += ' AND order_id = ?';
                params.push(options.order_id);
            }

            if (options.provider_id) {
                query += ' AND provider_id = ?';
                params.push(options.provider_id);
            }

            query += ' ORDER BY created_at DESC';

            const [rows] = await connection.execute(query, params);

            const proposals = rows.map(row => new Proposal(row));

            if (options.withRelations) {
                for (const proposal of proposals) {
                    await proposal.loadRelations(connection);
                }
            }

            return proposals;
        } finally {
            connection.release();
        }
    }

    static async findAccepted(options = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM proposals WHERE status = ?';
            const params = [Proposal.STATUS_ACCEPTED];

            if (options.order_id) {
                query += ' AND order_id = ?';
                params.push(options.order_id);
            }

            if (options.provider_id) {
                query += ' AND provider_id = ?';
                params.push(options.provider_id);
            }

            query += ' ORDER BY created_at DESC';

            const [rows] = await connection.execute(query, params);

            const proposals = rows.map(row => new Proposal(row));

            if (options.withRelations) {
                for (const proposal of proposals) {
                    await proposal.loadRelations(connection);
                }
            }

            return proposals;
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
                `UPDATE proposals SET ${fields.join(', ')} WHERE id = ?`,
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
            await connection.execute('DELETE FROM proposals WHERE id = ?', [this.id]);
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
            // Load order
            if (this.order_id) {
                const [orderRows] = await connection.execute(
                    'SELECT * FROM orders WHERE id = ?',
                    [this.order_id]
                );
                this.order = orderRows[0] || null;
            }

            // Load provider
            if (this.provider_id) {
                const [providerRows] = await connection.execute(
                    'SELECT id, name, email, phone, profile_type, avatar_base64 FROM users WHERE id = ?',
                    [this.provider_id]
                );
                this.provider = providerRows[0] || null;
            }

        } finally {
            if (shouldCloseConnection) {
                connection.release();
            }
        }
    }

    toJSON() {
        return { ...this };
    }
}

module.exports = Proposal;