const { getCustomer, listPaymentMethods, createSetupIntent, detachPaymentMethod, stripe, createCustomer } = require('../services/StripeService');
const User = require('../models/User');

module.exports = {
  async createWallet(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      if (user.stripe_customer_id) {
        return res.status(400).json({ success: false, message: 'Carteira já existe.' });
      }
      const customer = await createCustomer({
        name: user.name,
        email: user.email,
        phone: user.phone || undefined,
        metadata: { user_id: String(user._id) },
      });
      await User.findByIdAndUpdate(user._id, { stripe_customer_id: customer.id });
      return res.json({ success: true, message: 'Carteira criada com sucesso.' });
    } catch (error) {
      console.error('WalletController.createWallet error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao criar carteira.' });
    }
  },

  async getWallet(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user || !user.stripe_customer_id) {
        return res.status(404).json({ success: false, message: 'Carteira não encontrada.' });
      }
      const [customer, paymentMethods] = await Promise.all([
        getCustomer(user.stripe_customer_id),
        listPaymentMethods(user.stripe_customer_id),
      ]);
      return res.json({
        success: true,
        data: {
          stripe_customer_id: user.stripe_customer_id,
          balance: customer.balance,
          currency: customer.currency,
          payment_methods: paymentMethods.data.map(pm => ({
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          })),
        },
      });
    } catch (error) {
      console.error('WalletController.getWallet error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao buscar carteira.' });
    }
  },

  async createSetupIntent(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user || !user.stripe_customer_id) {
        return res.status(404).json({ success: false, message: 'Carteira não encontrada.' });
      }
      const setupIntent = await createSetupIntent(user.stripe_customer_id);
      return res.json({
        success: true,
        data: {
          client_secret: setupIntent.client_secret,
          setup_intent_id: setupIntent.id,
        },
      });
    } catch (error) {
      console.error('WalletController.createSetupIntent error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao criar intenção de pagamento.' });
    }
  },

  async removeCard(req, res) {
    try {
      const { payment_method_id } = req.params;
      await detachPaymentMethod(payment_method_id);
      return res.json({ success: true, message: 'Cartão removido com sucesso.' });
    } catch (error) {
      console.error('WalletController.removeCard error:', error.message);
      return res.status(500).json({ success: false, message: 'Erro ao remover cartão.' });
    }
  },
};
