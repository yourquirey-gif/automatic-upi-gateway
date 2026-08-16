import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ status: false, message: 'Authentication required' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    req.auth = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ status: false, message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({ status: false, message: 'Administrator access required' });
  }
  next();
}
