const { pool } = require('../config/database');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
}

module.exports = {
  // POST /api/affiliates/apply  (público)
  async apply(req, res) {
    try {
      const { name, email, instagram, code } = req.body;
      if (!name || !code) {
        return res.status(400).json({ success: false, message: 'Nome e código são obrigatórios.' });
      }
      const cleanCode = slugify(code);
      if (cleanCode.length < 3) {
        return res.status(400).json({ success: false, message: 'Código inválido. Use apenas letras e números, mínimo 3 caracteres.' });
      }

      const [existing] = await pool.query('SELECT id FROM affiliates WHERE code = ?', [cleanCode]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Este código já está em uso. Escolha outro.' });
      }

      const [result] = await pool.query(
        'INSERT INTO affiliates (name, email, instagram, code, status) VALUES (?, ?, ?, ?, ?)',
        [name, email || null, instagram || null, cleanCode, 'pending']
      );

      return res.status(201).json({
        success: true,
        message: 'Candidatura enviada com sucesso! Entraremos em contato em breve.',
        data: { id: result.insertId, code: cleanCode },
      });
    } catch (error) {
      console.error('AffiliateController.apply error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao enviar candidatura.' });
    }
  },

  // GET /api/affiliates/check/:code  (público)
  async checkCode(req, res) {
    try {
      const code = slugify(req.params.code || '');
      if (code.length < 3) {
        return res.json({ available: false, message: 'Código muito curto.' });
      }
      const [rows] = await pool.query('SELECT id FROM affiliates WHERE code = ?', [code]);
      return res.json({ available: rows.length === 0, code });
    } catch (error) {
      console.error('AffiliateController.checkCode error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao verificar código.' });
    }
  },

  // GET /api/affiliates/me  (autenticado)
  async getMe(req, res) {
    try {
      const [rows] = await pool.query('SELECT * FROM affiliates WHERE user_id = ?', [req.user.id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Você não é um afiliado.' });
      }
      return res.json({ success: true, data: rows[0] });
    } catch (error) {
      console.error('AffiliateController.getMe error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao buscar dados.' });
    }
  },

  // GET /api/affiliates/me/conversions  (autenticado)
  async getMyConversions(req, res) {
    try {
      const [affiliate] = await pool.query('SELECT id FROM affiliates WHERE user_id = ?', [req.user.id]);
      if (affiliate.length === 0) {
        return res.status(404).json({ success: false, message: 'Você não é um afiliado.' });
      }

      const [conversions] = await pool.query(
        `SELECT ac.*, u.name AS referred_name
         FROM affiliate_conversions ac
         LEFT JOIN users u ON u.id = ac.referred_user_id
         WHERE ac.affiliate_id = ?
         ORDER BY ac.created_at DESC`,
        [affiliate[0].id]
      );

      const totals = conversions.reduce(
        (acc, c) => {
          acc.total += Number(c.commission_value);
          if (c.status === 'paid') acc.paid += Number(c.commission_value);
          if (c.status === 'pending' || c.status === 'approved') acc.pending += Number(c.commission_value);
          return acc;
        },
        { total: 0, paid: 0, pending: 0 }
      );

      return res.json({ success: true, data: { conversions, totals } });
    } catch (error) {
      console.error('AffiliateController.getMyConversions error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao buscar conversões.' });
    }
  },

  // POST /api/affiliates/conversion  (interno — chamado pelo sistema ao registrar evento)
  async registerConversion(req, res) {
    try {
      const { ref_code, referred_user_id, event_type } = req.body;
      if (!ref_code || !referred_user_id || !event_type) {
        return res.status(400).json({ success: false, message: 'Dados incompletos.' });
      }

      const [affiliateRows] = await pool.query(
        'SELECT * FROM affiliates WHERE code = ? AND status = ?',
        [ref_code, 'active']
      );
      if (affiliateRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Afiliado não encontrado ou inativo.' });
      }
      const affiliate = affiliateRows[0];

      // evitar duplicata do mesmo evento para o mesmo usuário
      const [dup] = await pool.query(
        'SELECT id FROM affiliate_conversions WHERE affiliate_id = ? AND referred_user_id = ? AND event_type = ?',
        [affiliate.id, referred_user_id, event_type]
      );
      if (dup.length > 0) {
        return res.status(409).json({ success: false, message: 'Conversão já registrada.' });
      }

      const valueMap = {
        install: affiliate.commission_install,
        first_order: affiliate.commission_first_order,
        premium: affiliate.commission_premium,
      };
      const commissionValue = valueMap[event_type];
      if (commissionValue == null) {
        return res.status(400).json({ success: false, message: 'Tipo de evento inválido.' });
      }

      await pool.query(
        'INSERT INTO affiliate_conversions (affiliate_id, referred_user_id, event_type, commission_value) VALUES (?, ?, ?, ?)',
        [affiliate.id, referred_user_id, event_type, commissionValue]
      );

      return res.status(201).json({ success: true, message: 'Conversão registrada.', data: { commission_value: commissionValue } });
    } catch (error) {
      console.error('AffiliateController.registerConversion error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao registrar conversão.' });
    }
  },

  // GET /api/affiliates  (admin)
  async listAll(req, res) {
    try {
      const status = req.query.status || null;
      const query = status
        ? 'SELECT * FROM affiliates WHERE status = ? ORDER BY created_at DESC'
        : 'SELECT * FROM affiliates ORDER BY created_at DESC';
      const params = status ? [status] : [];
      const [rows] = await pool.query(query, params);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error('AffiliateController.listAll error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao listar afiliados.' });
    }
  },

  // PUT /api/affiliates/:id/status  (admin)
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['active', 'inactive', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
      }
      await pool.query('UPDATE affiliates SET status = ? WHERE id = ?', [status, id]);
      return res.json({ success: true, message: 'Status atualizado.' });
    } catch (error) {
      console.error('AffiliateController.updateStatus error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao atualizar status.' });
    }
  },
};
