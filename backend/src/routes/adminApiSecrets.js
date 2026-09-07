import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { decryptSecret } from '../utils/secretBox.js';

const router = Router();

router.get('/reveal', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.auth.sub, role: 'admin', status: 'active' })
      .select('+apiToken +instanceSecret +instanceSecretEncrypted +omniupiApiEncrypted webhookUrl userId');
    if (!user) return res.status(403).json({ status: false, message: 'Administrator access required' });

    let omniupiApi = String(user.apiToken || '').trim();
    if (user.omniupiApiEncrypted) {
      try { omniupiApi = decryptSecret(user.omniupiApiEncrypted); } catch {}
    }

    let instanceSecret = '';
    if (user.instanceSecretEncrypted) {
      try { instanceSecret = decryptSecret(user.instanceSecretEncrypted); } catch {}
    }
    if (!instanceSecret) instanceSecret = String(user.instanceSecret || '').trim();

    if (!omniupiApi || !instanceSecret) {
      return res.status(409).json({ status: false, message: 'Administrator API credentials are not fully configured' });
    }

    return res.json({
      status: true,
      credentials: {
        userId: user.userId,
        omniupiApi,
        instanceSecret,
        webhookUrl: user.webhookUrl || '',
        apiBaseUrl: 'https://api.omniupi.in/api',
        role: 'admin'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
