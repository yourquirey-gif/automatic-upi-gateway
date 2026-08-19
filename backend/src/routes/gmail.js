import { Router } from 'express';
import jwt from 'jsonwebtoken';
import GmailConnection from '../models/GmailConnection.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  createGoogleClient,
  createVerificationOrder,
  verifyMerchantGmail,
  verifyMerchantVerificationPayment,
  verifyPendingOrdersForAdmin
} from '../services/gmailPaymentVerifier.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';

const router = Router();

function safeReturnUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const allowed = [process.env.PUBLIC_WEB_BASE_URL, process.env.ADMIN_WEB_BASE_URL].filter(Boolean).map(x => String(x).replace(/\/$/, ''));
    return allowed.some(base => url.origin === new URL(base).origin) ? candidate : null;
  } catch { return null; }
}

async function getAdminSettlementMerchant(ownerId, settings) {
  const upiId = String(settings?.settlementUpiId || '').trim().toLowerCase();
  if (!upiId) return null;
  let merchant = await Merchant.findOne({ owner: ownerId, provider: 'admin_settlement' });
  if (!merchant) {
    merchant = await Merchant.create({
      owner: ownerId,
      name: settings?.settlementName || 'OmniUPI Settlement',
      provider: 'admin_settlement',
      upiId,
      mobile: String(settings?.settlementMobile || '').replace(/\D/g, '').slice(0, 10),
      config: { adminPaymentProvider: settings?.settlementProvider || 'UPI / Direct UPI' },
      status: 'pending',
      verificationStatus: 'pending',
      verificationMessage: 'Verify this UPI with a controlled ₹1 payment matched to the Gmail payment email.'
    });
  } else {
    const changed = String(merchant.upiId || '').toLowerCase() !== upiId;
    merchant.upiId = upiId;
    merchant.mobile = String(settings?.settlementMobile || merchant.mobile || '').replace(/\D/g, '').slice(0, 10);
    merchant.name = settings?.settlementName || merchant.name || 'OmniUPI Settlement';
    merchant.config = { ...(merchant.config || {}), adminPaymentProvider: settings?.settlementProvider || 'UPI / Direct UPI' };
    if (changed) {
      merchant.verificationStatus = 'pending';
      merchant.status = 'pending';
      merchant.verifiedAt = null;
      merchant.verifiedEmail = null;
      merchant.config = { ...(merchant.config || {}), verificationOrderId: null };
      merchant.verificationMessage = 'Payment account details changed. A new controlled ₹1 verification payment is required.';
    }
    await merchant.save();
  }
  return merchant;
}

router.get('/connect', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
    const upiId = String(settings?.settlementUpiId || '').trim().toLowerCase();
    if (!upiId) return res.status(400).json({ status: false, message: 'First save the Admin Payment UPI ID in Gateway & Payment Settings.' });
    const provider = String(req.query.provider || settings?.settlementProvider || 'UPI / Direct UPI').trim().slice(0, 80);
    const mobile = String(req.query.mobile || settings?.settlementMobile || '').replace(/\D/g, '').slice(0, 10);
    const merchant = await getAdminSettlementMerchant(req.auth.sub, { ...settings, settlementProvider: provider, settlementMobile: mobile, settlementUpiId: upiId });
    const verificationOrder = await createVerificationOrder(merchant);
    const client = await createGoogleClient('gmail');
    const returnUrl = safeReturnUrl(req.query.returnUrl);
    const state = jwt.sign({ sub: req.auth.sub, merchantId: String(merchant._id), purpose: 'admin-upi-verify', returnUrl }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', state, scope: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] });
    res.json({ status: true, url, upiId, provider, mobile, merchantId: merchant._id, verificationOrder });
  } catch (error) { next(error); }
});

router.post('/admin-upi/reset', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' }).sort({ createdAt: -1 });
    if (merchant) {
      await GmailConnection.deleteOne({ merchant: merchant._id });
      merchant.upiId = '';
      merchant.mobile = '';
      merchant.status = 'paused';
      merchant.verificationStatus = 'pending';
      merchant.verifiedAt = null;
      merchant.verifiedEmail = null;
      merchant.config = { ...(merchant.config || {}), verificationOrderId: null };
      merchant.verificationMessage = 'Previous Admin Settlement UPI was removed. Enter the new UPI details and verify again.';
      await merchant.save();
    }
    await GatewaySettings.findOneAndUpdate({ key: 'global' }, { $set: { settlementUpiId: '', settlementName: '', settlementProvider: 'UPI / Direct UPI', settlementMobile: '', subscriptionUpiId: '', subscriptionUpiName: '' } }, { upsert: true, new: true });
    res.json({ status: true, message: 'Previous Admin Settlement UPI removed. Add the new UPI and verify it again.' });
  } catch (error) { next(error); }
});

router.get('/callback', async (req, res, next) => {
  try {
    const payload = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (!payload?.sub || !['gmail-connect', 'merchant-gmail-verify', 'admin-upi-verify'].includes(payload.purpose)) return res.status(400).send('Invalid OAuth state');
    const client = await createGoogleClient('gmail');
    const { tokens } = await client.getToken(String(req.query.code || ''));
    client.setCredentials(tokens);
    const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();

    if (payload.purpose === 'merchant-gmail-verify' || payload.purpose === 'admin-upi-verify') {
      const ownerFilter = payload.purpose === 'admin-upi-verify' ? { role: 'admin', status: 'active' } : {};
      const owner = await User.findOne({ _id: payload.sub, ...ownerFilter });
      if (!owner) return res.status(403).send('Account is not authorized for this verification flow.');
      const merchant = await Merchant.findOne({ _id: payload.merchantId, owner: payload.sub });
      if (!merchant) return res.status(404).send('<h2>UPI verification record not found</h2>');
      let refreshToken = tokens.refresh_token || null;
      if (!refreshToken) {
        const existing = await GmailConnection.findOne({ merchant: merchant._id, active: true }).select('+refreshTokenEncrypted');
        if (existing?.refreshTokenEncrypted) refreshToken = decryptSecret(existing.refreshTokenEncrypted);
      }
      if (!refreshToken) return res.status(400).send('<h2>Gmail authorization failed</h2><p>Google did not return a refresh token and no previous Gmail connection exists. Disconnect the Google app permission and connect Gmail again.</p>');
      const result = await verifyMerchantGmail({ merchant, client, email: me.data.email, refreshToken, requirePaymentMatch: true });
      const fallback = String(payload.purpose === 'admin-upi-verify' ? (process.env.ADMIN_WEB_BASE_URL || process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in') : (process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in')).replace(/\/$/, '');
      const destination = safeReturnUrl(payload.returnUrl) || `${fallback}/`;
      const separator = destination.includes('?') ? '&' : '?';
      const verificationOrder = result.verificationOrder || (result.order ? { orderId: result.order.orderId, amount: result.order.amount, paymentUrl: result.order.paymentUrl, expiresAt: result.order.expiresAt } : null);
      const params = new URLSearchParams({
        merchant_id: String(merchant._id),
        merchant_verified: result.verified ? '1' : '0',
        merchant_message: result.message || '',
        ...(verificationOrder?.orderId ? { verification_order_id: verificationOrder.orderId } : {}),
        ...(verificationOrder?.paymentUrl ? { verification_payment_url: verificationOrder.paymentUrl } : {})
      });
      return res.redirect(`${destination}${separator}${params.toString()}#upi-verification`);
    }

    const admin = await User.findOne({ _id: payload.sub, role: 'admin', status: 'active' });
    if (!admin) return res.status(403).send('Administrator accounts must use administrator login.');
    const existing = await GmailConnection.findOne({ owner: payload.sub, active: true }).select('+refreshTokenEncrypted');
    const refreshToken = tokens.refresh_token || (existing?.refreshTokenEncrypted ? decryptSecret(existing.refreshTokenEncrypted) : null);
    await GmailConnection.findOneAndUpdate({ owner: payload.sub }, { owner: payload.sub, email: me.data.email, refreshTokenEncrypted: refreshToken ? encryptSecret(refreshToken) : existing?.refreshTokenEncrypted, active: true }, { upsert: true, new: true });
    res.redirect(`${String(process.env.ADMIN_WEB_BASE_URL || process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '')}/#admin`);
  } catch (error) { next(error); }
});

router.post('/sync', requireAuth, requireAdmin, async (req, res, next) => {
  try { res.json({ status: true, result: await verifyPendingOrdersForAdmin(req.auth.sub) }); } catch (error) { next(error); }
});

router.get('/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const connection = await GmailConnection.findOne({ owner: req.auth.sub, active: true });
    const merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' }).lean();
    let verification = merchant ? { ...merchant } : null;
    if (merchant && merchant.verificationStatus !== 'verified' && String(req.query.check || '') === '1' && connection) {
      const liveMerchant = await Merchant.findById(merchant._id);
      const liveConnection = await GmailConnection.findOne({ merchant: merchant._id, active: true }).select('+refreshTokenEncrypted');
      if (liveMerchant && liveConnection) {
        await verifyMerchantVerificationPayment({ merchant: liveMerchant, connection: liveConnection });
        verification = await Merchant.findById(merchant._id).lean();
      }
    }
    const verificationOrder = merchant?.config?.verificationOrderId
      ? await Order.findOne({ merchant: merchant._id, owner: req.auth.sub, orderId: String(merchant.config.verificationOrderId) }).select('orderId amount status paymentUrl expiresAt paidAt utr').lean()
      : null;
    res.json({ status: true, connected: !!connection, email: connection?.email || null, lastCheckedAt: connection?.lastCheckedAt || null, upiVerification: verification ? {
      upiId: verification.upiId,
      status: verification.verificationStatus,
      merchantStatus: verification.status,
      verifiedEmail: verification.verifiedEmail || null,
      verifiedAt: verification.verifiedAt || null,
      message: verification.verificationMessage || '',
      provider: verification.config?.adminPaymentProvider || 'UPI / Direct UPI',
      mobile: verification.mobile || null,
      verificationOrder: verificationOrder ? {
        orderId: verificationOrder.orderId,
        amount: verificationOrder.amount,
        status: verificationOrder.status,
        paymentUrl: verificationOrder.paymentUrl,
        expiresAt: verificationOrder.expiresAt,
        paidAt: verificationOrder.paidAt || null,
        utr: verificationOrder.utr || null
      } : null
    } : null });
  } catch (error) { next(error); }
});

export default router;
