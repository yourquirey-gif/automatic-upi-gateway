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
import User from './models/User.js';
import { verifyPendingOrdersForAdmin } from './services/gmailPaymentVerifier.js';

const app = express();
const port = Number(process.env.PORT || 5000);
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'automatic-upi-gateway-api' }));
app.get('/api/v1', (_req, res) => res.json({ name: 'Automatic UPI Gateway API', version: 'v1' }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/merchants', merchantRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/gmail', gmailRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ status: false, message: 'Internal server error' });
});

connectDatabase()
  .then(async () => {
    app.listen(port, () => console.log(`API listening on port ${port}`));
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
