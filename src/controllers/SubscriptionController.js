const {
  stripe,
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  getSubscription,
  findOrCreateCustomer,
} = require('../services/StripeService');
const User = require('../models/User');
const { pool } = require('../config/database');

const PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID;

module.exports = {
  // GET /subscriptions/status
  async status(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

      const now = new Date();
      const isActive = user.is_premium === 1 && user.premium_until && new Date(user.premium_until) > now;

      let subscriptionDetails = null;
      if (user.stripe_subscription_id) {
        try {
          const sub = await getSubscription(user.stripe_subscription_id);
          subscriptionDetails = {
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          };
        } catch (_) {
          // subscription may have been deleted on Stripe side
        }
      }

      return res.json({
        success: true,
        data: {
          is_premium: isActive,
          is_verified: user.is_verified === 1,
          premium_since: user.premium_since || null,
          premium_until: user.premium_until || null,
          subscription: subscriptionDetails,
        },
      });
    } catch (error) {
      console.error('SubscriptionController.status error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao buscar status da assinatura.' });
    }
  },

  // POST /subscriptions/subscribe
  async subscribe(req, res) {
    try {
      const { payment_method_id } = req.body;
      if (!payment_method_id) {
        return res.status(400).json({ success: false, message: 'payment_method_id é obrigatório.' });
      }
      if (!PRICE_ID) {
        return res.status(500).json({ success: false, message: 'Plano premium não configurado.' });
      }

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      if (user.profile_type !== 'provider') {
        return res.status(403).json({ success: false, message: 'Apenas prestadores podem assinar o plano premium.' });
      }

      // Already active — reactivate if scheduled to cancel
      if (user.stripe_subscription_id && user.is_premium) {
        let existing = null;
        try { existing = await getSubscription(user.stripe_subscription_id); } catch (_) {}
        if (existing && existing.status === 'active') {
          if (existing.cancel_at_period_end) {
            await reactivateSubscription(user.stripe_subscription_id);
            return res.json({ success: true, message: 'Assinatura reativada com sucesso.' });
          }
          return res.status(400).json({ success: false, message: 'Você já possui uma assinatura ativa.' });
        }
      }

      // Ensure Stripe customer exists
      let stripeCustomerId = user.stripe_customer_id;
      if (!stripeCustomerId) {
        const customer = await findOrCreateCustomer({
          name: user.name,
          email: user.email,
          phone: user.phone || undefined,
          metadata: { user_id: String(user.id) },
        });
        stripeCustomerId = customer.id;
        await user.update({ stripe_customer_id: stripeCustomerId });
      }

      const subscription = await createSubscription(stripeCustomerId, payment_method_id, PRICE_ID);

      const invoice = subscription.latest_invoice;
      const paymentIntent = invoice?.payment_intent;

      if (paymentIntent && paymentIntent.status === 'requires_action') {
        return res.json({
          success: false,
          requires_action: true,
          payment_intent_client_secret: paymentIntent.client_secret,
          message: 'Autenticação adicional necessária (3D Secure).',
        });
      }

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return res.status(402).json({ success: false, message: 'Pagamento recusado. Verifique seu cartão.' });
      }

      const periodEnd = new Date(subscription.current_period_end * 1000);
      await user.update({
        is_premium: 1,
        premium_since: new Date(),
        premium_until: periodEnd,
        stripe_subscription_id: subscription.id,
      });

      return res.json({
        success: true,
        message: 'Assinatura Premium ativada com sucesso!',
        data: {
          subscription_id: subscription.id,
          premium_until: periodEnd.toISOString(),
        },
      });
    } catch (error) {
      console.error('SubscriptionController.subscribe error:', error.message);
      const message = error.raw?.message || 'Erro ao processar assinatura.';
      return res.status(500).json({ success: false, message });
    }
  },

  // POST /subscriptions/cancel
  async cancel(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      if (!user.stripe_subscription_id) {
        return res.status(400).json({ success: false, message: 'Nenhuma assinatura ativa encontrada.' });
      }

      const subscription = await cancelSubscription(user.stripe_subscription_id);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      return res.json({
        success: true,
        message: 'Assinatura cancelada. Você mantém o acesso premium até o fim do período.',
        data: { premium_until: periodEnd.toISOString() },
      });
    } catch (error) {
      console.error('SubscriptionController.cancel error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao cancelar assinatura.' });
    }
  },

  // POST /webhooks/stripe  (raw body, no auth middleware)
  async webhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Stripe webhook signature error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await handleStripeEvent(event);
    } catch (err) {
      console.error('Stripe webhook handler error:', err.message);
    }

    return res.json({ received: true });
  },
};

async function handleStripeEvent(event) {
  const obj = event.data.object;

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = obj;
      const customerId = sub.customer;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      const periodEnd = new Date(sub.current_period_end * 1000);

      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.execute(
          'SELECT id FROM users WHERE stripe_customer_id = ? LIMIT 1',
          [customerId]
        );
        if (rows.length === 0) break;

        const userId = rows[0].id;
        await connection.execute(
          `UPDATE users SET
            is_premium = ?,
            premium_until = ?,
            stripe_subscription_id = ?
          WHERE id = ?`,
          [isActive ? 1 : 0, isActive ? periodEnd : null, sub.id, userId]
        );
        console.log(`[Stripe] subscription ${sub.status} → user ${userId}, premium until ${periodEnd}`);
      } finally {
        connection.release();
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = obj;
      if (invoice.billing_reason !== 'subscription_cycle') break;

      const customerId = invoice.customer;
      const subId = invoice.subscription;
      const sub = await getSubscription(subId);
      const periodEnd = new Date(sub.current_period_end * 1000);

      const connection = await pool.getConnection();
      try {
        await connection.execute(
          'UPDATE users SET is_premium = 1, premium_until = ? WHERE stripe_customer_id = ?',
          [periodEnd, customerId]
        );
        console.log(`[Stripe] renewal succeeded for customer ${customerId}, until ${periodEnd}`);
      } finally {
        connection.release();
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = obj;
      const customerId = invoice.customer;
      console.warn(`[Stripe] payment failed for customer ${customerId} — keeping premium until period ends`);
      // Stripe retries automatically; we don't revoke access immediately
      break;
    }

    default:
      break;
  }
}
