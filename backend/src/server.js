import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import merchantRoutes from './routes/merchants.js';
import adminRoutes from './routes/admin.js';
import gmailRoutes from './routes/gmail.js';
import subscriptionRoutes from './routes/subscriptions.js';
import accountRoutes from './routes/account.js';
import ordersRoutes from './routes/orders.js';
import kycRoutes from './routes/kyc.js';
import kycConfigRoutes from './routes/kycConfig.js';
import videoRoutes from './routes/videos.js';
import publicApiRoutes from './routes/publicApi.js';
import supportRoutes from './routes/support.js';
import User from './models/User.js';
import SubscriptionOrder from './models/SubscriptionOrder.js';
import { verifyAllConnectedGmails } from './services/gmailPaymentVerifier.js';

const app = express();
const port = Number(process.env.PORT || 5000);
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'omniupi-api', brand: 'OmniUPI', website: 'https://omniupi.in', api: 'https://api.omniupi.in' }));
app.get('/api/v1', (_req, res) => res.json({ name: 'OmniUPI API', brand: 'OmniUPI', version: 'v1', website: 'https://omniupi.in', docs: 'https://omniupi.in/docs' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/merchants', merchantRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/gmail', gmailRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/account', accountRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/kyc-config', kycConfigRoutes);
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api', publicApiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ status: false, message: 'Internal server error' });
});

// Creates the first administrator from hosting-provider environment variables.
// If the email already exists as a merchant, it is promoted only when the supplied
// ADMIN_PASSWORD matches that existing account password. No production password is
// stored in the repository. Admin accounts are permanent and subscription-free.
async function ensureBootstrapAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    console.log('Admin bootstrap skipped: ADMIN_EMAIL/ADMIN_PASSWORD not configured.');
    return;
  }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  const existing = await User.findOne({ email }).select('+passwordHash');
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
      name: process.env.ADMIN_NAME || 'Administrator',
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
      trialStartedAt: null,
      trialEndsAt: null,
      plan: null,
      planStatus: 'NONE'
    });
    console.log(`Bootstrap admin created: ${email}`);
    return;
  }

  const passwordMatches = existing.passwordHash ? await bcrypt.compare(password, existing.passwordHash) : false;
  if (!passwordMatches) {
    throw new Error(`ADMIN_PASSWORD does not match the existing account: ${email}`);
  }

  let changed = false;
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    changed = true;
  }
  if (existing.status !== 'active') {
    existing.status = 'active';
    changed = true;
  }
  if (existing.trialStartedAt || existing.trialEndsAt || existing.plan || existing.planStatus !== 'NONE') {
    existing.trialStartedAt = null;
    existing.trialEndsAt = null;
    existing.plan = null;
    existing.planStartedAt = null;
    existing.planExpiresAt = null;
    existing.planStatus = 'NONE';
    changed = true;
  }
  if (changed) {
    await existing.save({ validateBeforeSave: false });
    console.log(`Bootstrap admin synchronized: ${email}`);
  } else {
    console.log(`Bootstrap admin verified: ${email}`);
  }
}

async function expireSubscriptions() {
  const now = new Date();
  const expiredUsers = await User.find({ plan: { $ne: null }, planExpiresAt: { $ne: null, $lte: now }, planStatus: 'ACTIVE' }).select('_id plan');
  for (const user of expiredUsers) {
    await SubscriptionOrder.updateMany({ user: user._id, plan: user.plan, status: 'SUCCESS', planExpiresAt: { $lte: now } }, { $set: { status: 'EXPIRED' } });
    await User.updateOne({ _id: user._id }, { $set: { plan: null, planStatus: 'EXPIRED' } });
  }
  return expiredUsers.length;
}

connectDatabase()
  .then(async () => {
    await ensureBootstrapAdmin();
    app.listen(port, () => console.log(`OmniUPI API listening on port ${port}`));
    await expireSubscriptions().catch((error) => console.error('Initial expiry check failed:', error.message));
    setInterval(() => expireSubscriptions().catch((error) => console.error('Subscription expiry check failed:', error.message)), Number(process.env.SUBSCRIPTION_EXPIRY_CHECK_MS || 60000));
    if (process.env.GMAIL_AUTO_SYNC === 'true') {
      setInterval(async () => {
        try {
          const result = await verifyAllConnectedGmails();
          if (result.confirmed || result.subscriptionsActivated || result.kycPaymentsConfirmed) console.log('Gmail verification:', result);
        } catch (error) { console.error('Gmail sync failed:', error.message); }
      }, Number(process.env.GMAIL_SYNC_INTERVAL_MS || 60000));
    }
  })
  .catch((error) => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  });
