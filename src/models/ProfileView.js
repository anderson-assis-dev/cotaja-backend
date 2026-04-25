const { pool } = require('../config/database');

class ProfileView {
  static async ensureTable() {
    const connection = await pool.getConnection();
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS profile_views (
          id INT AUTO_INCREMENT PRIMARY KEY,
          provider_id INT NOT NULL,
          viewer_id INT NULL,
          viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_provider_id (provider_id),
          INDEX idx_viewer_id (viewer_id),
          INDEX idx_viewed_at (viewed_at)
        )
      `);
    } finally {
      connection.release();
    }
  }

  static async record(provider_id, viewer_id = null) {
    await ProfileView.ensureTable();
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'INSERT INTO profile_views (provider_id, viewer_id, viewed_at) VALUES (?, ?, NOW())',
        [provider_id, viewer_id]
      );
    } finally {
      connection.release();
    }
  }

  static async getStats(provider_id, is_premium = false) {
    await ProfileView.ensureTable();
    const connection = await pool.getConnection();
    try {
      const [todayRows] = await connection.execute(
        `SELECT COUNT(*) AS total FROM profile_views
         WHERE provider_id = ? AND viewed_at >= CURDATE()`,
        [provider_id]
      );

      // Viewers today who don't have an active/completed order with this provider
      const [noQuoteRows] = await connection.execute(
        `SELECT COUNT(DISTINCT pv.viewer_id) AS total
         FROM profile_views pv
         WHERE pv.provider_id = ?
           AND pv.viewed_at >= CURDATE()
           AND pv.viewer_id IS NOT NULL
           AND pv.viewer_id NOT IN (
             SELECT DISTINCT client_id FROM orders
             WHERE provider_id = ? AND status IN ('in_progress', 'completed')
           )`,
        [provider_id, provider_id]
      );

      const profile_views_today = Number(todayRows[0].total) || 0;
      const no_quote_today = Math.min(
        Number(noQuoteRows[0].total) || 0,
        profile_views_today
      );

      let viewers = [];
      if (is_premium) {
        const [viewerRows] = await connection.execute(
          `SELECT pv.id, pv.viewer_id, pv.viewed_at, u.name, u.avatar_base64,
             (SELECT o.id FROM orders o
              WHERE o.client_id = pv.viewer_id
                AND o.provider_id = ?
                AND o.status IN ('in_progress', 'completed')
              ORDER BY o.updated_at DESC LIMIT 1) AS order_id,
             CASE WHEN EXISTS (
               SELECT 1 FROM orders o
               WHERE o.client_id = pv.viewer_id
                 AND o.provider_id = ?
                 AND o.status IN ('in_progress', 'completed')
             ) THEN 1 ELSE 0 END AS opened_quote
           FROM profile_views pv
           LEFT JOIN users u ON u.id = pv.viewer_id
           WHERE pv.provider_id = ?
           ORDER BY pv.viewed_at DESC
           LIMIT 10`,
          [provider_id, provider_id, provider_id]
        );
        viewers = viewerRows.map(r => ({
          id: r.id,
          viewer_id: r.viewer_id,
          name: r.name || 'Cliente',
          avatar_base64: r.avatar_base64 || null,
          viewed_at: r.viewed_at,
          opened_quote: r.opened_quote === 1,
          order_id: r.order_id ? Number(r.order_id) : null,
        }));
      }

      return { profile_views_today, no_quote_today, viewers };
    } finally {
      connection.release();
    }
  }
}

module.exports = ProfileView;
