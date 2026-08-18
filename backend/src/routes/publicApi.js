import { Router } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import { verifyPendingOrdersForAdmin } from '../services/gmailPaymentVerifier.js';

const router = Router();
const CANONICAL_SITE = 'https://omniupi.in';
const CANONICAL_API = 'https://api.omniupi.in';

function getApiToken(req) { const authorization = String(req.headers.authorization || ''); if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim(); return String(req.body?.user_token || req.body?.api_token || req.headers['x-api-key'] || '').trim(); }
async function requireApiUser(req, res, next) { try { const token = getApiToken(req); if (!token) return res.status(401).json({ status: false, message: 'API token is required' }); const user = await User.findOne({ apiToken: token, status: 'active', role: { $in: ['merchant','admin'] } }).select('+apiToken +instanceSecret webhookUrl userId name email role'); if (!user) return res.status(401).json({ status: false, message: 'Invalid or inactive API token' }); req.apiUser = user; next(); } catch (error) { next(error); } }
function cleanString(value, max = 500) { return String(value ?? '').trim().slice(0, max); }
function makeOrderId() { return `${Date.now()}${crypto.randomBytes(4).toString('hex')}`.slice(0, 24); }
function buildPaymentUrl(_req, order) { return `${CANONICAL_SITE}/pay?order_id=${encodeURIComponent(order.orderId)}`; }
function buildUpiUrl(order, merchant) { const pa = cleanString(merchant.upiId, 200), pn = cleanString(merchant.name || merchant.provider || 'Merchant', 80), tn = cleanString(order.remark1 || `Payment ${order.orderId}`, 80); return `upi://pay?${new URLSearchParams({ pa, pn, am: Number(order.amount).toFixed(2), tr: order.orderId, cu: 'INR', tn }).toString()}`; }
function checkoutConfig(merchant) { const c = merchant?.config?.checkout || {}; return { brandName: cleanString(c.brandName || merchant?.name || 'Merchant', 100), themeColor: /^#[0-9a-fA-F]{6}$/.test(c.themeColor || '') ? c.themeColor : '#0B95BD', instructions: cleanString(c.instructions || '', 3000), showQrCode: c.showQrCode !== false, showIntentButtons: c.showIntentButtons !== false, brandLogo: typeof c.brandLogo === 'string' ? c.brandLogo : '' }; }

router.post('/create-order', requireApiUser, async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount), customerMobile = cleanString(req.body?.customer_mobile || req.body?.customerMobile, 20), redirectUrl = cleanString(req.body?.redirect_url || req.body?.redirectUrl, 1000), remark1 = cleanString(req.body?.remark1, 200), remark2 = cleanString(req.body?.remark2, 200), requestedOrderId = cleanString(req.body?.order_id || req.body?.orderId, 100);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ status: false, message: 'amount must be a positive number' });
    if (amount > 1000000) return res.status(400).json({ status: false, message: 'amount exceeds the allowed limit' });
    if (redirectUrl && !/^https?:\/\//i.test(redirectUrl)) return res.status(400).json({ status: false, message: 'redirect_url must include http or https' });
    const merchantId = cleanString(req.body?.merchant_id || req.body?.merchantId, 100);
    const merchantQuery = { owner: req.apiUser._id, status: 'active' };
    if (req.apiUser.role === 'admin' && !merchantId) merchantQuery.provider = 'admin_settlement';
    if (merchantId) merchantQuery._id = merchantId;
    const merchant = await Merchant.findOne(merchantQuery).sort({ createdAt: -1 });
    if (!merchant) return res.status(400).json({ status: false, message: 'No active merchant connection found. Verify the payment UPI first.' });
    if (!merchant.upiId) return res.status(400).json({ status: false, message: 'Merchant UPI ID is not configured' });
    const orderId = requestedOrderId || makeOrderId();
    if (await Order.exists({ orderId })) return res.status(409).json({ status: false, message: 'order_id already exists' });
    const amountFixed = Number(amount.toFixed(2)), feePercent = Number(merchant.planTransactionFeePercent || 0);
    const order = await Order.create({ merchant: merchant._id, owner: req.apiUser._id, orderId, amount: amountFixed, customerMobile, redirectUrl, remark1, remark2, status: 'PENDING', feePercent, netAmount: amountFixed, paymentUrl: '' });
    order.paymentUrl = buildPaymentUrl(req, order); await order.save();
    const upiUrl = buildUpiUrl(order, merchant);
    res.status(201).json({ status: true, message: 'Order Created Successfully', result: { txnStatus: 'PENDING', orderId: order.orderId, order_id: order.orderId, amount: order.amount.toFixed(2), paymentUrl: order.paymentUrl, payment_url: order.paymentUrl, upiUrl, upi_url: upiUrl, redirectUrl: order.redirectUrl || null, customerMobile: order.customerMobile || null, remark1: order.remark1 || null, remark2: order.remark2 || null } });
  } catch (error) { next(error); }
});

router.post('/check-order-status', requireApiUser, async (req, res, next) => {
  try {
    const orderId = cleanString(req.body?.order_id || req.body?.orderId, 100); if (!orderId) return res.status(400).json({ status: false, message: 'order_id is required' });
    const existing = await Order.findOne({ orderId, owner: req.apiUser._id }).lean(); if (!existing) return res.status(404).json({ status: false, message: 'Order not found' });
    if (existing.status === 'PENDING') await verifyPendingOrdersForAdmin(req.apiUser._id).catch(error => console.error('On-demand Gmail verification failed:', error.message));
    const order = await Order.findOne({ orderId, owner: req.apiUser._id }).lean();
    res.json({ status: true, message: order.status === 'SUCCESS' ? 'Transaction Successfully' : `Transaction ${order.status}`, result: { txnStatus: order.status, orderId: order.orderId, order_id: order.orderId, amount: Number(order.amount).toFixed(2), date: order.paidAt || order.createdAt, utr: order.utr || null, customerMobile: order.customerMobile || null, redirectUrl: order.redirectUrl || null, remark1: order.remark1 || null, remark2: order.remark2 || null } });
  } catch (error) { next(error); }
});

router.get('/payment/:orderId/status', async (req, res, next) => { try { const order = await Order.findOne({ orderId: req.params.orderId }).select('orderId amount status paidAt utr redirectUrl').lean(); if (!order) return res.status(404).json({ status: false, message: 'Order not found' }); res.set('Cache-Control', 'no-store, max-age=0'); res.json({ status: true, result: { txnStatus: order.status, orderId: order.orderId, amount: Number(order.amount).toFixed(2), paidAt: order.paidAt || null, utr: order.utr || null, redirectUrl: order.redirectUrl || null } }); } catch (error) { next(error); } });

router.get('/payment/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('merchant').lean(); if (!order) return res.status(404).send('<h1>Order not found</h1>');
    if (order.status === 'SUCCESS') { const redirect = order.redirectUrl ? `<script>location.replace(${JSON.stringify(order.redirectUrl)});</script>` : ''; return res.type('html').send(`<!doctype html><html><body style="font-family:Arial;text-align:center;padding:40px"><h1>Payment Successful</h1><p>Order: ${order.orderId}</p>${redirect}</body></html>`); }
    const merchant = order.merchant || {}, c = checkoutConfig(merchant), upiUrl = buildUpiUrl(order, merchant), safeUpi = JSON.stringify(upiUrl), qr = c.showQrCode ? await QRCode.toDataURL(upiUrl, { margin: 1, width: 260, errorCorrectionLevel: 'M' }) : '';
    const instructions = c.instructions ? c.instructions.split(/\r?\n/).map(x => x.trim()).filter(Boolean).map(x => `<li>${escapeHtml(x)}</li>`).join('') : '';
    const logo = c.brandLogo ? `<img src="${escapeAttr(c.brandLogo)}" alt="Logo" style="width:42px;height:42px;border-radius:10px;object-fit:cover">` : `<div class="storeIcon">▣</div>`;
    const qrBlock = c.showQrCode ? `<div class="scan"><span class="scanTag">▦ &nbsp; Scan & Pay</span><div class="qrLine"><img id="qr" src="${qr}" alt="UPI QR"><div><div class="auto">● &nbsp; Auto-pay active</div><a download="payment-qr.png" href="${qr}" class="download" style="background:${c.themeColor}">⇩ &nbsp; Download QR</a></div></div></div>` : '';
    const intents = c.showIntentButtons ? `<div class="intents"><a href=${safeUpi} class="intent paytm">◉ <b>PayTM</b><span>Pay via app ›</span></a><a href=${safeUpi} class="intent phonepe">● <b>PhonePe</b><span>Pay via app ›</span></a><a href=${safeUpi} class="intent gpay">◆ <b>Google Pay</b><span>Share QR ›</span></a></div>` : '';
    const inst = instructions ? `<div class="instructions"><b>Payment Instructions</b><ul>${instructions}</ul></div>` : '';
    const safeName = escapeHtml(c.brandName), color = c.themeColor;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${color}"><title>Pay ₹${Number(order.amount).toFixed(2)} · ${safeName}</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#172033;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:560px;margin:0 auto;padding:22px 14px 30px}.card{background:#fff;border-radius:25px;overflow:hidden;box-shadow:0 12px 35px #17203312}.top{background:${color};color:#fff;padding:24px 22px 25px;position:relative}.brand{display:flex;align-items:center;gap:11px;font-size:19px;font-weight:800}.storeIcon{width:42px;height:42px;border-radius:10px;background:#ffffff2b;display:grid;place-items:center}.brand img{background:#fff}.timer{position:absolute;right:18px;top:18px;background:#ffffff25;border-radius:99px;padding:8px 12px;font-size:12px}.amountLabel{margin-top:30px;font-size:12px;opacity:.8}.amount{font-size:35px;font-weight:850;margin-top:2px}.body{padding:22px 18px 17px}.scan{border:1px solid #e9edf2;border-radius:17px;padding:15px;background:#fafbfc}.scanTag{display:inline-block;border:1px solid #e8edf1;border-radius:99px;padding:7px 10px;font-size:12px;color:#218ea9;background:#fff}.qrLine{display:flex;gap:18px;align-items:center;margin-top:13px}.qrLine img{width:126px;height:126px;background:#fff;border-radius:12px}.auto{font-size:12px;color:#6f7b89;margin-bottom:10px}.download{display:inline-block;color:#fff;text-decoration:none;border-radius:99px;padding:9px 12px;font-size:12px;font-weight:700}.intents{display:grid;gap:10px;margin-top:16px}.intent{height:56px;border:2px solid;border-radius:30px;display:flex;align-items:center;gap:12px;padding:0 18px;text-decoration:none;color:#243044;font-size:15px}.intent span{margin-left:auto;color:#9aa3b0;font-size:12px}.paytm{border-color:#16a7cf}.phonepe{border-color:#6d2aa2}.gpay{border-color:#49ad68}.instructions{margin-top:16px;background:#f7f9fb;border-radius:13px;padding:13px;font-size:12px;color:#5f6b7a}.instructions b{font-size:13px;color:#263247}.instructions ul{margin:8px 0 0;padding-left:18px;line-height:1.7}.live-status{margin-top:16px;border:1px solid #e7ebef;border-radius:13px;padding:12px;text-align:center;color:#6c7786;font-size:12px;background:#fafbfc}.footer{border-top:1px solid #eef0f3;padding:12px 16px;display:flex;justify-content:space-between;color:#8993a0;font-size:11px}.secure{color:#18a978}.powered b{color:${color}}</style></head><body><div class="wrap"><div class="card"><div class="top"><div class="brand">${logo}<span>${safeName}</span></div><div class="timer">◷ <span id="timer">5:00</span></div><div class="amountLabel">Amount</div><div class="amount">₹${Number(order.amount).toFixed(2)}</div></div><div class="body">${qrBlock}${intents}${inst}<div id="paymentStatus" class="live-status">Waiting for payment confirmation…</div></div><div class="footer"><span class="secure">🔒 Secure</span><span class="powered">Powered by <b>OmniUPI</b></span></div></div></div><script>let s=300;setInterval(()=>{s=Math.max(0,s-1);const m=Math.floor(s/60),x=String(s%60).padStart(2,'0');document.getElementById('timer').textContent=m+':'+x},1000);const statusUrl=${JSON.stringify(`${CANONICAL_API}/api/v1/payment/${encodeURIComponent(order.orderId)}/status`)};let checking=false;async function checkPayment(){if(checking)return;checking=true;try{const r=await fetch(statusUrl,{cache:'no-store'});const d=await r.json();const x=d.result;if(x?.txnStatus==='SUCCESS'){document.getElementById('paymentStatus').textContent='✓ Payment received successfully';document.getElementById('paymentStatus').style.color='#159b77';if(x.redirectUrl){setTimeout(()=>location.replace(x.redirectUrl),500)}else{setTimeout(()=>location.reload(),900)}}else{document.getElementById('paymentStatus').textContent='Waiting for payment confirmation…'}}catch{}finally{checking=false}}checkPayment();setInterval(checkPayment,3000);</script></body></html>`;
    res.set('Cache-Control', 'no-store, max-age=0'); res.type('html').send(html);
  } catch (error) { next(error); }
});

function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function escapeAttr(v) { return escapeHtml(v).replace(/`/g, '&#96;'); }
router.get('/health', (_req, res) => res.json({ status: true, service: 'OmniUPI Public API', version: '1.4', website: CANONICAL_SITE, api: CANONICAL_API }));
export default router;
