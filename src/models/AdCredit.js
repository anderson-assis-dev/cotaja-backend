const { pool } = require('../config/database');

class AdPackage {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || null;
    this.slug = data.slug || null;
    this.price_cents = data.price_cents || 0;
    this.ad_count = data.ad_count || 0;
    this.ad_type = data.ad_type || null;
    this.description = data.description || null;
    this.active = data.active !== undefined ? data.active : 1;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  static async findAll() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM ad_packages WHERE active = 1 ORDER BY price_cents ASC'
      );
      if (rows.length === 0) {
        await AdPackage.ensureDefaults(connection);
        const [seeded] = await connection.execute(
          'SELECT * FROM ad_packages WHERE active = 1 ORDER BY price_cents ASC'
        );
        return seeded.map(r => new AdPackage(r));
      }
      return rows.map(r => new AdPackage(r));
    } finally {
      connection.release();
    }
  }

  static async ensureDefaults(connection) {
    const defaults = [
      ['Anúncio Único', 'single-5', 500, 1, 'single', 'Um anúncio avulso enviado para todos os usuários.'],
      ['2 Anúncios Gerais', 'general-15', 1500, 2, 'general', 'Dois anúncios gerais enviados para todos sem filtro.'],
      ['3 Anúncios Categorizados', 'targeted-25', 2500, 3, 'targeted', 'Três anúncios enviados apenas para usuários próximos e com interesse na sua categoria.'],
    ];
    for (const [name, slug, price, count, type, desc] of defaults) {
      await connection.execute(
        `INSERT IGNORE INTO ad_packages (name, slug, price_cents, ad_count, ad_type, description, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [name, slug, price, count, type, desc]
      );
    }
  }

  static async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM ad_packages WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return new AdPackage(rows[0]);
    } finally {
      connection.release();
    }
  }
}

class AdPurchase {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.package_id = data.package_id || null;
    this.stripe_payment_intent_id = data.stripe_payment_intent_id || null;
    this.amount_cents = data.amount_cents || 0;
    this.remaining_ads = data.remaining_ads || 0;
    this.ad_type = data.ad_type || null;
    this.status = data.status || 'pending';
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  static async create(data) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO ad_purchases (user_id, package_id, stripe_payment_intent_id, amount_cents, remaining_ads, ad_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [data.user_id, data.package_id, data.stripe_payment_intent_id || null, data.amount_cents, data.remaining_ads, data.ad_type, data.status || 'pending']
      );
      return await AdPurchase.findById(result.insertId);
    } finally {
      connection.release();
    }
  }

  static async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM ad_purchases WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return new AdPurchase(rows[0]);
    } finally {
      connection.release();
    }
  }

  static async findByUser(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT ap.*, pkg.name as package_name, pkg.slug as package_slug
         FROM ad_purchases ap
         JOIN ad_packages pkg ON ap.package_id = pkg.id
         WHERE ap.user_id = ?
         ORDER BY ap.created_at DESC`,
        [userId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  static async findActiveByUser(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT ap.*, pkg.name as package_name
         FROM ad_purchases ap
         JOIN ad_packages pkg ON ap.package_id = pkg.id
         WHERE ap.user_id = ? AND ap.status = 'paid' AND ap.remaining_ads > 0
         ORDER BY ap.created_at ASC`,
        [userId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  static async decrementRemaining(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE ad_purchases SET remaining_ads = remaining_ads - 1, updated_at = NOW() WHERE id = ? AND remaining_ads > 0',
        [id]
      );
    } finally {
      connection.release();
    }
  }

  static async updateStatus(id, status, paymentIntentId) {
    const connection = await pool.getConnection();
    try {
      const fields = ['status = ?', 'updated_at = NOW()'];
      const values = [status];
      if (paymentIntentId) {
        fields.push('stripe_payment_intent_id = ?');
        values.push(paymentIntentId);
      }
      values.push(id);
      await connection.execute(
        `UPDATE ad_purchases SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } finally {
      connection.release();
    }
  }
}

class Ad {
  constructor(data = {}) {
    this.id = data.id || null;
    this.purchase_id = data.purchase_id || null;
    this.user_id = data.user_id || null;
    this.title = data.title || null;
    this.message = data.message || null;
    this.ad_type = data.ad_type || null;
    this.target_categories = data.target_categories || null;
    this.target_radius_km = data.target_radius_km || 50;
    this.scheduled_date = data.scheduled_date || null;
    this.scheduled_time = data.scheduled_time || null;
    this.status = data.status || 'scheduled';
    this.sent_count = data.sent_count || 0;
    this.sent_at = data.sent_at || null;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  static async create(data) {
    const connection = await pool.getConnection();
    try {
      const targetCategoriesJson = data.target_categories ? JSON.stringify(data.target_categories) : null;
      const [result] = await connection.execute(
        `INSERT INTO ads (purchase_id, user_id, title, message, ad_type, target_categories, target_radius_km, scheduled_date, scheduled_time, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NOW(), NOW())`,
        [data.purchase_id, data.user_id, data.title, data.message, data.ad_type, targetCategoriesJson, data.target_radius_km || 50, data.scheduled_date, data.scheduled_time]
      );
      return await Ad.findById(result.insertId);
    } finally {
      connection.release();
    }
  }

  static async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM ads WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      const ad = new Ad(rows[0]);
      if (ad.target_categories && typeof ad.target_categories === 'string') {
        try { ad.target_categories = JSON.parse(ad.target_categories); } catch { ad.target_categories = []; }
      }
      return ad;
    } finally {
      connection.release();
    }
  }

  static async findByUser(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM ads WHERE user_id = ? ORDER BY scheduled_date DESC, scheduled_time DESC',
        [userId]
      );
      return rows.map(r => {
        if (r.target_categories && typeof r.target_categories === 'string') {
          try { r.target_categories = JSON.parse(r.target_categories); } catch { r.target_categories = []; }
        }
        return new Ad(r);
      });
    } finally {
      connection.release();
    }
  }

  static async findPendingToSend() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT a.*, u.name as user_name, u.service_categories, u.latitude as provider_lat, u.longitude as provider_lng, u.profile_type
         FROM ads a
         JOIN users u ON a.user_id = u.id
         WHERE a.status = 'scheduled'
         AND CONCAT(a.scheduled_date, ' ', a.scheduled_time) <= NOW()
         ORDER BY a.scheduled_date ASC, a.scheduled_time ASC`
      );
      return rows.map(r => {
        if (r.target_categories && typeof r.target_categories === 'string') {
          try { r.target_categories = JSON.parse(r.target_categories); } catch { r.target_categories = []; }
        }
        if (r.service_categories && typeof r.service_categories === 'string') {
          try { r.service_categories = JSON.parse(r.service_categories); } catch { r.service_categories = []; }
        }
        return r;
      });
    } finally {
      connection.release();
    }
  }

  static async markSent(id, sentCount) {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE ads SET status = ?, sent_count = ?, sent_at = NOW(), updated_at = NOW() WHERE id = ?',
        ['sent', sentCount, id]
      );
    } finally {
      connection.release();
    }
  }

  static async markFailed(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        "UPDATE ads SET status = 'failed', updated_at = NOW() WHERE id = ?",
        [id]
      );
    } finally {
      connection.release();
    }
  }

  static async cancel(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        "UPDATE ads SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND status = 'scheduled'",
        [id]
      );
    } finally {
      connection.release();
    }
  }
}

class UserSearchCategory {
  static async track(userId, category) {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO user_search_categories (user_id, category, search_count, last_searched_at, created_at)
         VALUES (?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE search_count = search_count + 1, last_searched_at = NOW()`,
        [userId, category]
      );
    } catch {
    } finally {
      connection.release();
    }
  }

  static async getUsersInterestedInCategories(categories, excludeUserId) {
    const connection = await pool.getConnection();
    try {
      if (!categories || categories.length === 0) return [];
      const placeholders = categories.map(() => '?').join(',');
      const [rows] = await connection.execute(
        `SELECT DISTINCT u.id, u.fcm_token, u.device_platform, u.latitude, u.longitude
         FROM user_search_categories usc
         JOIN users u ON usc.user_id = u.id
         WHERE usc.category IN (${placeholders})
         AND usc.last_searched_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)
         AND u.id != ?
         AND u.fcm_token IS NOT NULL
         AND u.fcm_token != ''`,
        [...categories, excludeUserId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  static async getProvidersForTargetedAd(categories, excludeUserId) {
    const connection = await pool.getConnection();
    try {
      if (!categories || categories.length === 0) return [];
      const [providers] = await connection.execute(
        `SELECT u.id, u.fcm_token, u.device_platform, u.latitude, u.longitude,
                u.service_categories,
                COALESCE((
                  SELECT AVG(pr.rating) FROM provider_ratings pr WHERE pr.provider_id = u.id
                ), 0) as avg_rating,
                COALESCE((
                  SELECT COUNT(*) FROM provider_ratings pr WHERE pr.provider_id = u.id
                ), 0) as ratings_count
         FROM users u
         WHERE u.profile_type = 'provider'
         AND u.id != ?
         AND u.fcm_token IS NOT NULL
         AND u.fcm_token != ''
         ORDER BY avg_rating DESC, ratings_count DESC`,
        [excludeUserId]
      );
      return providers.filter(p => {
        let cats = p.service_categories;
        if (typeof cats === 'string') {
          try { cats = JSON.parse(cats); } catch { cats = []; }
        }
        if (!Array.isArray(cats)) return false;
        return categories.some(c => cats.includes(c));
      });
    } finally {
      connection.release();
    }
  }
}

module.exports = { AdPackage, AdPurchase, Ad, UserSearchCategory };
