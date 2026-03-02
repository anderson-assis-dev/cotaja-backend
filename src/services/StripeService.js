const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia',
});

async function createCustomer({ name, email, phone, metadata = {} }) {
  const customer = await stripe.customers.create({
    name,
    email,
    phone: phone || undefined,
    metadata,
  });
  return customer;
}

async function findOrCreateCustomer({ name, email, phone, metadata = {} }) {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0];
  return createCustomer({ name, email, phone, metadata });
}

async function getCustomer(stripeCustomerId) {
  return stripe.customers.retrieve(stripeCustomerId);
}

async function listPaymentMethods(stripeCustomerId) {
  return stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: 'card',
  });
}

async function createSetupIntent(stripeCustomerId) {
  return stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
  });
}

async function detachPaymentMethod(paymentMethodId) {
  return stripe.paymentMethods.detach(paymentMethodId);
}

async function createPaymentIntent({ amount, currency = 'brl', customerId, paymentMethodId, metadata = {} }) {
  return stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    metadata,
  });
}

module.exports = { stripe, createCustomer, findOrCreateCustomer, getCustomer, listPaymentMethods, createSetupIntent, detachPaymentMethod, createPaymentIntent };
