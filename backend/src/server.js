import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import merchantRoutes from './routes/merchants.js';

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'automatic-upi-gateway-api' });
});

app.get('/api/v1', (_req, res) => {
  res.json({ name: 'Automatic UPI Gateway API', version: 'v1' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/merchants', merchantRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ status: false, message: 'Internal server error' });
});

connectDatabase()
  .then(() => app.listen(port, () => console.log(`API listening on port ${port}`)))
  .catch((error) => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  });
