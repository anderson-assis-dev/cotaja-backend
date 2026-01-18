const { pool } = require('../config/database');

class Service {
    constructor(data = {}) {
        this.id = data.id || null;
        this.title = data.title || null;
        this.description = data.description || null;
        this.price = data.price || null;
        this.category = data.category || null;
        this.status = data.status || 'active';
        this.provider_id = data.provider_id || null;
        this.images = data.images || null;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;
    }

    static async create(serviceData) {
        const connection = await pool.getConnection();
        try {
            const imagesJson = serviceData.images ? JSON.stringify(serviceData.images) : null;

            const [result] = await connection.execute(
                `INSERT INTO services (title, description, price, category, status, provider_id, images, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    serviceData.title,
                    serviceData.description,
                    serviceData.price,
                    serviceData.category,
                    serviceData.status || 'active',
                    serviceData.provider_id,
                    imagesJson
                ]
            );

            return await Service.findById(result.insertId);
        } finally {
            connection.release();
        }
    }

    static async findById(id) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM services WHERE id = ?',
                [id]
            );

            if (rows.length === 0) {
                return null;
            }

            const serviceData = rows[0];
            // Parse images JSON if it exists
            if (serviceData.images) {
                try {
                    serviceData.images = JSON.parse(serviceData.images);
                } catch (e) {
                    serviceData.images = [];
                }
            } else {
                serviceData.images = [];
            }

            return new Service(serviceData);
        } finally {
            connection.release();
        }
    }

    static async findByProviderId(providerId) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC',
                [providerId]
            );

            return rows.map(row => {
                // Parse images JSON if it exists
                if (row.images) {
                    try {
                        row.images = JSON.parse(row.images);
                    } catch (e) {
                        row.images = [];
                    }
                } else {
                    row.images = [];
                }
                return new Service(row);
            });
        } finally {
            connection.release();
        }
    }

    static async update(id, serviceData) {
        const connection = await pool.getConnection();
        try {
            const imagesJson = serviceData.images ? JSON.stringify(serviceData.images) : null;

            const [result] = await connection.execute(
                `UPDATE services
                 SET title = ?, description = ?, price = ?, category = ?, status = ?, images = ?, updated_at = NOW()
                 WHERE id = ?`,
                [
                    serviceData.title,
                    serviceData.description,
                    serviceData.price,
                    serviceData.category,
                    serviceData.status,
                    imagesJson,
                    id
                ]
            );

            if (result.affectedRows === 0) {
                return null;
            }

            return await Service.findById(id);
        } finally {
            connection.release();
        }
    }

    static async delete(id) {
        const connection = await pool.getConnection();
        try {
            const [result] = await connection.execute(
                'DELETE FROM services WHERE id = ?',
                [id]
            );

            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    static async findAll(filters = {}) {
        const connection = await pool.getConnection();
        try {
            let query = 'SELECT * FROM services';
            const params = [];
            const conditions = [];

            if (filters.status) {
                conditions.push('status = ?');
                params.push(filters.status);
            }

            if (filters.category) {
                conditions.push('category = ?');
                params.push(filters.category);
            }

            if (filters.provider_id) {
                conditions.push('provider_id = ?');
                params.push(filters.provider_id);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY created_at DESC';

            const [rows] = await connection.execute(query, params);
            return rows.map(row => {
                // Parse images JSON if it exists
                if (row.images) {
                    try {
                        row.images = JSON.parse(row.images);
                    } catch (e) {
                        row.images = [];
                    }
                } else {
                    row.images = [];
                }
                return new Service(row);
            });
        } finally {
            connection.release();
        }
    }
}

module.exports = Service;