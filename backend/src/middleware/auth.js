import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ status: false, message: 'Authentication required' });
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    req.auth = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ status: false, message: 'Invalid or expired token' });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    if (req.auth?.role !== 'admin' || !req.auth?.sub) return res.status(403).json({ status: false, message: 'Administrator access required' });
    const user = await User.findOne({ _id: req.auth.sub, role: 'admin', status: 'active' }).select('_id role status email plan planStatus trialEndsAt planExpiresAt');
    if (!user) return res.status(403).json({ status: false, message: 'Administrator account is inactive or no longer authorized' });
    req.admin = user;
    req.subscription = { required: false, active: true, permanent: true };
    next();
  } catch (error) {
    if (error?.name === 'CastError') return res.status(403).json({ status: false, message: 'Administrator access denied' });
    next(error);
  }
}
