import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import User from './models/User.js';
import SubscriptionOrder from './models/SubscriptionOrder.js';
import { verifyPendingOrdersForAdmin } from './services/gmailPaymentVerifier.js';

const app = express();
const port = Number(process.env.PORT || 5000);
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'automatic-upi-gateway-api' }));
app.get('/api/v1', (_req, res) => res.json({ name: 'Automatic UPI Gateway API', version: 'v1' }));
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
app.use('/api', publicApiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ status: false, message: 'Internal server error' });
});

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
    app.listen(port, () => console.log(`API listening on port ${port}`));
    await expireSubscriptions().catch((error) => console.error('Initial expiry check failed:', error.message));
    setInterval(() => expireSubscriptions().catch((error) => console.error('Subscription expiry check failed:', error.message)), Number(process.env.SUBSCRIPTION_EXPIRY_CHECK_MS || 60000));
    if (process.env.GMAIL_AUTO_SYNC === 'true') {
      setInterval(async () => {
        try {
          const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
          for (const admin of admins) await verifyPendingOrdersForAdmin(admin._id);
        } catch (error) { console.error('Gmail sync failed:', error.message); }
      }, Number(process.env.GMAIL_SYNC_INTERVAL_MS || 60000));
    }
  })
  .catch((error) => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  });
