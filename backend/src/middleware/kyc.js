import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import KycOrder from '../models/KycOrder.js';

export async function requireKycIfEnabled(req, res, next) {
  try {
    const settings = await GatewaySettings.findOne({ key: 'global' });
    if (!settings?.kycRequired) return next();
    const user = await User.findById(req.auth.sub).select('kycStatus');
    if (user?.kycStatus === 'VERIFIED') return next();
    const latest = await KycOrder.findOne({ user: req.auth.sub }).sort({ createdAt: -1 }).select('status rejectionReason');
    return res.status(403).json({
      status: false,
      code: 'KYC_REQUIRED',
      message: 'KYC verification is required before using this feature',
      kycStatus: user?.kycStatus || 'NOT_SUBMITTED',
      latestRequest: latest || null
    });
  } catch (error) { next(error); }
}
