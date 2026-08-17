import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import { nextUserId } from '../utils/userId.js';

const router = Router();

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: '7d' });
}

function trialDates() {
  const started = new Date();
  const ends = new Date(started.getTime() + 2 * 24 * 60 * 60 * 1000);
  return { started, ends };
}

function createApiCredentials() {
  return {
    apiToken: `ag_live_${crypto.randomBytes(32).toString('hex')}`,
    instanceSecret: `ag_sec_${crypto.randomBytes(32).toString('hex')}`
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ status: false, message: 'Name, valid email and password of at least 8 characters are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ status: false, message: 'Email is already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const { started, ends } = trialDates();
    const userId = await nextUserId();
    const { apiToken, instanceSecret } = createApiCredentials();
    const user = await User.create({
      userId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      apiToken,
      instanceSecret,
      webhookUrl: '',
      trialStartedAt: started,
      trialEndsAt: ends
    });
    const token = signToken(user);
    res.status(201).json({
      status: true,
      token,
      trial: { active: true, startedAt: started, endsAt: ends, durationDays: 2 },
      user: { id: user._id, userId: user.userId, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() }).select('+passwordHash');
    if (!user || user.status !== 'active' || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ status: false, message: 'Invalid email or password' });
    }
    const token = signToken(user);
    if (user.role === 'admin') {
      return res.json({
        status: true,
        token,
        trial: { active: false, endsAt: null },
        subscription: { required: false, active: true, permanent: true },
        user: { id: user._id, userId: user.userId || null, name: user.name, email: user.email, role: 'admin' }
      });
    }
    const trialActive = !!user.trialEndsAt && user.trialEndsAt.getTime() > Date.now() && !user.plan;
    res.json({
      status: true,
      token,
      trial: { active: trialActive, endsAt: user.trialEndsAt },
      subscription: { required: true, active: !!user.plan && user.planStatus === 'ACTIVE', permanent: false },
      user: { id: user._id, userId: user.userId || null, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) { next(error); }
});

export default router;
