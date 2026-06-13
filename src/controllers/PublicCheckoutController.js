const {
  findOrCreateCustomer,
  createCustomer,
  createSubscription,
  getSubscription,
} = require('../services/StripeService');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

const PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID;

function activeUntil(user) {
  if (user.is_premium === 1 && user.premium_until && new Date(user.premium_until) > new Date()) {
    return new Date(user.premium_until);
  }
  return null;
}

async function ensureCustomer(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await findOrCreateCustomer({
    name: user.name,
    email: user.email,
    phone: user.phone || undefined,
    metadata: { user_id: String(user.id), source: 'landing_premium' },
  });
  await user.update({ stripe_customer_id: customer.id });
  return customer.id;
}

async function finalizeSubscription(res, user, subscription, isNew) {
  const invoice = subscription.latest_invoice;
  const paymentIntent = invoice?.payment_intent;

  if (paymentIntent && paymentIntent.status === 'requires_action') {
    return res.json({
      success: false,
      requires_action: true,
      payment_intent_client_secret: paymentIntent.client_secret,
      subscription_id: subscription.id,
      message: 'Autenticação adicional necessária (3D Secure).',
    });
  }

  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return res.status(402).json({ success: false, message: 'Pagamento recusado. Verifique os dados do seu cartão.' });
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
    message: 'Premium ativado com sucesso!',
    data: {
      token: generateToken({ userId: user.id }),
      user: user.toJSON(),
      premium_until: periodEnd.toISOString(),
      is_new: isNew,
    },
  });
}

module.exports = {
  async premiumCheckout(req, res) {
    try {
      const {
        name, email, phone, password, cpf, mother_name, birth_date,
        service_categories, ref_code, payment_method_id,
      } = req.body;

      if (!email || !payment_method_id) {
        return res.status(422).json({ success: false, message: 'E-mail e dados de pagamento são obrigatórios.' });
      }
      if (!PRICE_ID) {
        return res.status(500).json({ success: false, message: 'Plano premium não configurado.' });
      }

      let user = await User.findByEmail(email);
      let isNew = false;

      if (!user) {
        if (!name || !password || !mother_name || !birth_date) {
          return res.status(422).json({
            success: false,
            message: 'Preencha nome, senha, nome da mãe e data de nascimento para criar sua conta.',
          });
        }

        const userData = {
          name,
          email,
          phone: phone || null,
          password,
          profile_type: 'provider',
          cpf: cpf || null,
          mother_name,
          birth_date,
          service_categories: service_categories || null,
        };

        try {
          const stripeCustomer = await createCustomer({
            name,
            email,
            phone: phone || undefined,
            metadata: { profile_type: 'provider', source: 'landing_premium' },
          });
          userData.stripe_customer_id = stripeCustomer.id;
        } catch (stripeError) {
          console.error('Stripe customer creation failed (non-blocking):', stripeError.message);
        }

        user = await User.create(userData);
        await user.update({ activate: 1 });
        isNew = true;

        if (ref_code) {
          try {
            const { pool } = require('../config/database');
            const cleanCode = String(ref_code).toLowerCase().replaceAll(/[^a-z0-9]/g, '');
            const [rows] = await pool.query('SELECT * FROM affiliates WHERE code = ? AND status = ?', [cleanCode, 'active']);
            if (rows.length > 0) {
              const affiliate = rows[0];
              await pool.query('UPDATE users SET ref_code = ?, referred_by = ? WHERE id = ?', [affiliate.code, affiliate.id, user.id]);
              await pool.query(
                'INSERT INTO affiliate_conversions (affiliate_id, referred_user_id, event_type, commission_value) VALUES (?, ?, ?, ?)',
                [affiliate.id, user.id, 'install', affiliate.commission_install]
              );
            }
          } catch (affiliateError) {
            console.error('Affiliate tracking error (non-blocking):', affiliateError.message);
          }
        }
      } else {
        const validPassword = password ? await user.verifyPassword(password) : false;
        if (!validPassword) {
          return res.status(403).json({
            success: false,
            account_exists: true,
            message: 'Já existe uma conta com este e-mail. Informe a senha correta para ativar o Premium.',
          });
        }

        if (user.profile_type !== 'provider') {
          await user.update({ profile_type: 'provider' });
        }
        if (user.activate !== 1) {
          await user.update({ activate: 1 });
        }

        if (activeUntil(user)) {
          return res.json({
            success: true,
            already_premium: true,
            message: 'Você já é Premium!',
            data: {
              token: generateToken({ userId: user.id }),
              user: user.toJSON(),
              premium_until: new Date(user.premium_until).toISOString(),
            },
          });
        }
      }

      const stripeCustomerId = await ensureCustomer(user);
      const subscription = await createSubscription(stripeCustomerId, payment_method_id, PRICE_ID);
      return await finalizeSubscription(res, user, subscription, isNew);
    } catch (error) {
      console.error('PublicCheckoutController.premiumCheckout error:', error.message);
      const message = error.raw?.message || 'Erro ao processar o pagamento. Tente novamente.';
      return res.status(500).json({ success: false, message });
    }
  },

  async confirmPremium(req, res) {
    try {
      const { email, subscription_id } = req.body;
      if (!email || !subscription_id) {
        return res.status(422).json({ success: false, message: 'Dados insuficientes para confirmar o pagamento.' });
      }

      const user = await User.findByEmail(email);
      if (!user) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });

      const subscription = await getSubscription(subscription_id);
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return res.status(402).json({ success: false, message: 'Pagamento ainda não confirmado.' });
      }

      const periodEnd = new Date(subscription.current_period_end * 1000);
      await user.update({
        is_premium: 1,
        premium_since: user.premium_since || new Date(),
        premium_until: periodEnd,
        stripe_subscription_id: subscription.id,
      });

      return res.json({
        success: true,
        message: 'Premium ativado com sucesso!',
        data: {
          token: generateToken({ userId: user.id }),
          user: user.toJSON(),
          premium_until: periodEnd.toISOString(),
        },
      });
    } catch (error) {
      console.error('PublicCheckoutController.confirmPremium error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao confirmar o pagamento.' });
    }
  },
};
