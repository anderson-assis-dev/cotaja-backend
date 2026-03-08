const { AdPackage, AdPurchase, Ad } = require('../models/AdCredit');
const User = require('../models/User');
const Order = require('../models/Order');
const { createPaymentIntent } = require('../services/StripeService');

class AdController {
  constructor() {
    this.getPackages = this.getPackages.bind(this);
    this.purchasePackage = this.purchasePackage.bind(this);
    this.getMyPurchases = this.getMyPurchases.bind(this);
    this.getMyAds = this.getMyAds.bind(this);
    this.scheduleAd = this.scheduleAd.bind(this);
    this.cancelAd = this.cancelAd.bind(this);
    this.getAdCredits = this.getAdCredits.bind(this);
  }

  async getPackages(req, res) {
    try {
      const packages = await AdPackage.findAll();
      console.log(`[AdController] getPackages: ${packages.length} pacotes`);
      return res.json({ success: true, data: packages });
    } catch (error) {
      console.error('[AdController] getPackages error:', error);
      return res.status(500).json({ success: false, message: 'Erro ao listar pacotes.' });
    }
  }

  async purchasePackage(req, res) {
    try {
      const { package_id, payment_method_id } = req.body;
      const userId = req.user.id;

      console.log(`[AdController] purchasePackage: user=${userId} pkg=${package_id} pm=${payment_method_id ? 'sim' : 'nao'}`);

      if (!package_id || !payment_method_id) {
        return res.status(400).json({ success: false, message: 'Pacote e método de pagamento são obrigatórios.' });
      }

      const pkg = await AdPackage.findById(package_id);
      if (!pkg || !pkg.active) {
        console.error(`[AdController] Pacote ${package_id} não encontrado ou inativo`);
        return res.status(404).json({ success: false, message: 'Pacote não encontrado.' });
      }

      const user = await User.findById(userId);
      if (!user || !user.stripe_customer_id) {
        return res.status(400).json({ success: false, message: 'Carteira não configurada. Adicione um cartão primeiro.' });
      }

      const purchase = await AdPurchase.create({
        user_id: userId,
        package_id: pkg.id,
        amount_cents: pkg.price_cents,
        remaining_ads: pkg.ad_count,
        ad_type: pkg.ad_type,
        status: 'pending',
      });

      try {
        const paymentIntent = await createPaymentIntent({
          amount: pkg.price_cents,
          currency: 'brl',
          customerId: user.stripe_customer_id,
          paymentMethodId: payment_method_id,
          metadata: {
            type: 'ad_purchase',
            purchase_id: String(purchase.id),
            user_id: String(userId),
            package_slug: pkg.slug,
          },
        });

        await AdPurchase.updateStatus(purchase.id, 'paid', paymentIntent.id);
        console.log(`[AdController] Compra ${purchase.id} paga com sucesso (${pkg.slug})`);

        return res.json({
          success: true,
          message: `Pacote "${pkg.name}" comprado com sucesso! Você tem ${pkg.ad_count} anúncio(s) disponível(is).`,
          data: {
            purchase_id: purchase.id,
            remaining_ads: pkg.ad_count,
            ad_type: pkg.ad_type,
          },
        });
      } catch (stripeError) {
        await AdPurchase.updateStatus(purchase.id, 'failed');
        console.error('[AdController] Stripe error:', stripeError.message);
        return res.status(400).json({
          success: false,
          message: stripeError.message || 'Erro ao processar pagamento.',
        });
      }
    } catch (error) {
      console.error('[AdController] purchasePackage error:', error);
      return res.status(500).json({ success: false, message: 'Erro ao comprar pacote.' });
    }
  }

  async getMyPurchases(req, res) {
    try {
      const purchases = await AdPurchase.findByUser(req.user.id);
      return res.json({ success: true, data: purchases });
    } catch (error) {
      console.error('AdController.getMyPurchases error:', error);
      return res.status(500).json({ success: false, message: 'Erro ao listar compras.' });
    }
  }

  async getAdCredits(req, res) {
    try {
      const activePurchases = await AdPurchase.findActiveByUser(req.user.id);
      const totalRemaining = activePurchases.reduce((sum, p) => sum + p.remaining_ads, 0);
      const byType = {
        single: activePurchases.filter(p => p.ad_type === 'single').reduce((s, p) => s + p.remaining_ads, 0),
        general: activePurchases.filter(p => p.ad_type === 'general').reduce((s, p) => s + p.remaining_ads, 0),
        targeted: activePurchases.filter(p => p.ad_type === 'targeted').reduce((s, p) => s + p.remaining_ads, 0),
      };
      return res.json({
        success: true,
        data: { total_remaining: totalRemaining, by_type: byType, purchases: activePurchases },
      });
    } catch (error) {
      console.error('AdController.getAdCredits error:', error);
      return res.status(500).json({ success: false, message: 'Erro ao buscar créditos.' });
    }
  }

  async scheduleAd(req, res) {
    try {
      const { purchase_id, title, message, scheduled_date, scheduled_time, target_categories, target_radius_km, linked_order_id, linked_service_id } = req.body;
      const userId = req.user.id;

      if (!purchase_id || !title || !message || !scheduled_date || !scheduled_time) {
        return res.status(400).json({ success: false, message: 'Todos os campos obrigatórios devem ser preenchidos.' });
      }

      const scheduledDateTime = new Date(`${scheduled_date}T${scheduled_time}`);
      if (scheduledDateTime <= new Date()) {
        return res.status(400).json({ success: false, message: 'A data de agendamento deve ser futura.' });
      }

      const activePurchases = await AdPurchase.findActiveByUser(userId);
      const purchase = activePurchases.find(p => p.id === purchase_id);
      if (!purchase || purchase.remaining_ads <= 0) {
        return res.status(400).json({ success: false, message: 'Compra não encontrada ou sem créditos disponíveis.' });
      }

      let resolvedCategories = target_categories;
      if (!resolvedCategories || resolvedCategories.length === 0) {
        const user = await User.findById(userId);
        if (user && user.profile_type === 'provider' && user.service_categories) {
          resolvedCategories = user.service_categories;
        } else if (linked_order_id) {
          const order = await Order.findById(linked_order_id);
          if (order && order.category) {
            resolvedCategories = [order.category];
          }
        }
      }
      req.body.target_categories = resolvedCategories || [];

      const ad = await Ad.create({
        purchase_id: purchase.id,
        user_id: userId,
        title,
        message,
        ad_type: purchase.ad_type,
        target_categories: req.body.target_categories || target_categories,
        target_radius_km: purchase.ad_type === 'targeted' ? 100 : null,
        scheduled_date,
        scheduled_time,
      });

      await AdPurchase.decrementRemaining(purchase.id);

      return res.status(201).json({
        success: true,
        message: 'Anúncio agendado com sucesso!',
        data: ad,
      });
    } catch (error) {
      console.error('AdController.scheduleAd error:', error);
      return res.status(500).json({ success: false, message: 'Erro ao agendar anúncio.' });
    }
  }

  async getMyAds(req, res) {
    try {
      const ads = await Ad.findByUser(req.user.id);
      return res.json({ success: true, data: ads });
    } catch (error) {
      console.error('AdController.getMyAds error:', error);
      return res.status(500).json({ success: false, message: 'Erro ao listar anúncios.' });
    }
  }

  async cancelAd(req, res) {
    try {
      const { id } = req.params;
      const ad = await Ad.findById(id);
      if (!ad) return res.status(404).json({ success: false, message: 'Anúncio não encontrado.' });
      if (ad.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Sem permissão.' });
      if (ad.status !== 'scheduled') return res.status(400).json({ success: false, message: 'Apenas anúncios agendados podem ser cancelados.' });

      await Ad.cancel(id);

      const purchase = await AdPurchase.findById(ad.purchase_id);
      if (purchase) {
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          await connection.execute(
            'UPDATE ad_purchases SET remaining_ads = remaining_ads + 1, updated_at = NOW() WHERE id = ?',
            [ad.purchase_id]
          );
        } finally {
          connection.release();
        }
      }

      return res.json({ success: true, message: 'Anúncio cancelado. O crédito foi devolvido.' });
    } catch (error) {
      console.error('AdController.cancelAd error:', error);
      return res.status(500).json({ success: false, message: 'Erro ao cancelar anúncio.' });
    }
  }
}

module.exports = new AdController();
