import crypto from 'crypto';

export async function sendMerchantWebhook(user, order) {
  const webhookUrl = String(user?.webhookUrl || '').trim();
  const secret = String(user?.instanceSecret || '').trim();
  if (!webhookUrl || !secret) return { sent: false, reason: 'webhook_not_configured' };

  const payload = JSON.stringify({
    status: order.status,
    order_id: order.orderId,
    customer_mobile: order.customerMobile || '',
    amount: Number(order.amount).toFixed(2),
    utr: order.utr || '',
    remark1: order.remark1 || '',
    remark2: order.remark2 || '',
    timestamp: Math.floor(Date.now() / 1000)
  });
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'payment.success'
      },
      body: payload,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return { sent: response.ok, statusCode: response.status };
  } catch (error) {
    return { sent: false, reason: error.name === 'AbortError' ? 'timeout' : error.message };
  }
}
