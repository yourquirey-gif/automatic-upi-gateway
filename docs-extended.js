(function () {
  const API_BASE = 'https://api.omniupi.in';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const code = (value) => `<pre class="doc-code"><button class="doc-copy" onclick="copyDoc(${JSON.stringify(String(value))})">Copy</button><code>${esc(value)}</code></pre>`;

  const extraSection = (icon, title, subtitle, body) => `
    <section class="doc-section doc-extra-section">
      <div class="doc-section-head"><span class="doc-icon">${icon}</span><div><h2>${title}</h2><p>${subtitle}</p></div></div>
      ${body}
    </section>`;

  function normalizeDocs() {
    const app = document.getElementById('app');
    if (!app) return;

    // The public API is deployed on the API subdomain. Keep all existing
    // documentation sections, but make their endpoint examples point to the
    // live API host instead of the website host.
    app.innerHTML = app.innerHTML.replaceAll('https://omniupi.in/api/', `${API_BASE}/api/`);

    // Remove repository-hosting references from the public documentation UI.
    app.innerHTML = app.innerHTML.replaceAll('GitHub', 'source repository');
  }

  function appendExtendedReference() {
    const app = document.getElementById('app');
    if (!app || app.querySelector('.doc-extra-reference')) return;

    const bearer = 'Authorization: Bearer YOUR_API_TOKEN';
    const formHeaders = 'Content-Type: application/x-www-form-urlencoded';

    const createForm = `curl -X POST '${API_BASE}/api/create-order' \\\n  -H 'Authorization: Bearer YOUR_API_TOKEN' \\\n  -H 'Content-Type: application/x-www-form-urlencoded' \\\n  --data-urlencode 'amount=499' \\\n  --data-urlencode 'customer_mobile=9876543210' \\\n  --data-urlencode 'order_id=ORDER_1001' \\\n  --data-urlencode 'remark1=Order 1001'`;

    const statusForm = `curl -X POST '${API_BASE}/api/check-order-status' \\\n  -H 'Authorization: Bearer YOUR_API_TOKEN' \\\n  -H 'Content-Type: application/x-www-form-urlencoded' \\\n  --data-urlencode 'order_id=ORDER_1001'`;

    const phpStatus = `<?php
$api_url = '${API_BASE}/api/check-order-status';
$post_data = [
    'user_token' => 'YOUR_API_TOKEN',
    'order_id' => 'ORDER_1001'
];

$ch = curl_init($api_url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($post_data),
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    CURLOPT_TIMEOUT => 20
]);
$response = curl_exec($ch);
if ($response === false) {
    throw new Exception(curl_error($ch));
}
curl_close($ch);
echo $response;
?>`;

    const nodeStatus = `const response = await fetch('${API_BASE}/api/check-order-status', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ order_id: 'ORDER_1001' })
});
const data = await response.json();
console.log(data);`;

    const pythonStatus = `import requests

response = requests.post(
    '${API_BASE}/api/check-order-status',
    headers={'Authorization': 'Bearer YOUR_API_TOKEN'},
    json={'order_id': 'ORDER_1001'},
    timeout=20
)
print(response.json())`;

    const createResponse = JSON.stringify({
      status: true,
      message: 'Order Created Successfully',
      result: {
        txnStatus: 'PENDING',
        orderId: 'ORDER_1001',
        order_id: 'ORDER_1001',
        amount: '499.00',
        paymentUrl: `${API_BASE}/api/payment/ORDER_1001`,
        payment_url: `${API_BASE}/api/payment/ORDER_1001`,
        upiUrl: 'upi://pay?...',
        upi_url: 'upi://pay?...'
      }
    }, null, 2);

    const statusResponse = JSON.stringify({
      status: true,
      message: 'Transaction Successfully',
      result: {
        txnStatus: 'SUCCESS',
        orderId: 'ORDER_1001',
        order_id: 'ORDER_1001',
        amount: '499.00',
        date: '2026-08-17T10:20:00.000Z',
        utr: '123456789012',
        customerMobile: '9876543210',
        remark1: 'Order 1001',
        remark2: ''
      }
    }, null, 2);

    const webhookHandler = `<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Only POST requests are allowed');
}

$instance_secret = 'YOUR_INSTANCE_SECRET';
$raw_body = file_get_contents('php://input');
$received_signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$expected_signature = hash_hmac('sha256', $raw_body, $instance_secret);

if (!$received_signature || !hash_equals($expected_signature, $received_signature)) {
    http_response_code(401);
    exit('Invalid Signature');
}

$data = json_decode($raw_body, true);
if (!is_array($data) || ($data['status'] ?? '') !== 'SUCCESS') {
    http_response_code(400);
    exit('Invalid status');
}

$order_id = $data['order_id'] ?? '';
$amount   = $data['amount'] ?? '';
$utr      = $data['utr'] ?? '';
// Match order_id + amount in your database before fulfillment.
// Make fulfillment idempotent so duplicate notifications are safe.
echo 'SUCCESS';
?>`;

    const body = `
      <div class="doc-extra-reference">
        ${extraSection('🧩', 'Complete Integration Reference', 'Detailed request formats and response structures for the live PayIN API.', `
          <div class="doc-alert">All examples below use the live API host <b>${API_BASE}</b>. Replace <b>YOUR_API_TOKEN</b> and order placeholders with your merchant credentials/data. Never publish secrets in browser code.</div>
          <h3>Authentication options</h3>
          <table class="doc-table"><thead><tr><th>Method</th><th>Header / Field</th><th>Recommended</th></tr></thead><tbody>
            <tr><td>Bearer</td><td><code>${esc(bearer)}</code></td><td>✓ Recommended</td></tr>
            <tr><td>Legacy form field</td><td><code>user_token=YOUR_API_TOKEN</code></td><td>Compatibility</td></tr>
            <tr><td>API token field</td><td><code>api_token=YOUR_API_TOKEN</code></td><td>Compatibility</td></tr>
            <tr><td>API key header</td><td><code>X-API-Key: YOUR_API_TOKEN</code></td><td>Compatibility</td></tr>
          </tbody></table>
          <div class="doc-note">The server accepts Bearer authentication first, while legacy token fields remain supported for existing integrations.</div>
        `)}

        ${extraSection('💳', 'PayIN — Create Order', 'Request parameters, headers, examples and the complete response.', `
          <div class="doc-endpoint"><span class="method post">POST</span><b>${API_BASE}/api/create-order</b></div>
          <h3>Request headers</h3>${code(`${bearer}\n${formHeaders}`)}
          <h3>Request parameters</h3>
          <table class="doc-table"><thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>
            <tr><td>amount</td><td>number</td><td>Yes</td><td>Positive INR amount. Maximum enforced by the backend: ₹1,000,000.</td></tr>
            <tr><td>customer_mobile</td><td>string</td><td>No</td><td>Customer mobile number.</td></tr>
            <tr><td>merchant_id</td><td>string</td><td>No</td><td>Select a specific active connected merchant when multiple merchants exist.</td></tr>
            <tr><td>order_id</td><td>string</td><td>No</td><td>Your unique reference. Existing IDs are rejected with HTTP 409.</td></tr>
            <tr><td>redirect_url</td><td>URL</td><td>No</td><td>Must start with http:// or https:// when supplied.</td></tr>
            <tr><td>remark1</td><td>string</td><td>No</td><td>Product/order reference.</td></tr>
            <tr><td>remark2</td><td>string</td><td>No</td><td>Additional reference.</td></tr>
          </tbody></table>
          <h3>Form-encoded cURL</h3>${code(createForm)}
          <h3>JSON cURL</h3>${code(`curl -X POST '${API_BASE}/api/create-order' \\\n  -H 'Authorization: Bearer YOUR_API_TOKEN' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"amount":499,"customer_mobile":"9876543210","order_id":"ORDER_1001","remark1":"Order 1001"}'`)}
          <h3>Response</h3>${code(createResponse)}
          <div class="doc-note">Save <b>orderId</b> and <b>paymentUrl</b>. Send the customer to the hosted payment page. Do not mark the order paid from frontend code.</div>
        `)}

        ${extraSection('📊', 'PayIN Status', 'Check the latest server-side status of an order.', `
          <div class="doc-endpoint"><span class="method post">POST</span><b>${API_BASE}/api/check-order-status</b></div>
          <h3>Request parameters</h3>
          <table class="doc-table"><thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>
            <tr><td>order_id</td><td>string</td><td>Yes</td><td>Order ID returned by Create Order.</td></tr>
          </tbody></table>
          <h3>Request headers</h3>${code(`${bearer}\n${formHeaders}`)}
          <h3>Form-encoded request</h3>${code(statusForm)}
          <h3>JSON request</h3>${code(nodeStatus)}
          <h3>PHP example</h3>${code(phpStatus)}
          <h3>Python example</h3>${code(pythonStatus)}
          <h3>Response</h3>${code(statusResponse)}
          <div class="status-row"><span class="doc-pill pending">PENDING</span><span class="doc-pill ok">SUCCESS</span><span class="doc-pill bad">FAILED</span><span class="doc-pill bad">EXPIRED</span></div>
        `)}

        ${extraSection('🌐', 'Hosted Payment & Status URLs', 'Public URLs used after an order is created.', `
          <div class="doc-summary">
            <div><span class="method get">GET</span><b>${API_BASE}/api/payment/{order_id}</b><small>Hosted customer payment page</small></div>
            <div><span class="method get">GET</span><b>${API_BASE}/api/payment/{order_id}/status</b><small>Public checkout status JSON</small></div>
            <div><span class="method get">GET</span><b>${API_BASE}/api/health</b><small>API health check</small></div>
          </div>
          <div class="doc-note">The hosted payment page generates the UPI intent/QR from the connected merchant and continuously checks the server-side payment status.</div>
        `)}

        ${extraSection('🔔', 'Webhook', 'Receive real-time SUCCESS notifications on your merchant server.', `
          <div class="doc-alert">When Gmail/payment verification confirms a pending order as SUCCESS, OmniUPI sends a POST request to the merchant webhook URL configured in the account. The request is signed with HMAC-SHA256 using the merchant Instance Secret.</div>
          <h3>Webhook headers</h3>
          <table class="doc-table"><thead><tr><th>Header</th><th>Value</th><th>Purpose</th></tr></thead><tbody>
            <tr><td>Content-Type</td><td>application/json</td><td>JSON request body</td></tr>
            <tr><td>X-Webhook-Signature</td><td>HMAC-SHA256 hex</td><td>Verify payload authenticity</td></tr>
            <tr><td>X-Webhook-Event</td><td>payment.success</td><td>Event type</td></tr>
          </tbody></table>
          <h3>Webhook JSON payload</h3>${code(JSON.stringify({status:'SUCCESS',order_id:'ORDER_1001',customer_mobile:'9876543210',amount:'499.00',utr:'2387476826',remark1:'Order 1001',remark2:'',timestamp:1786013741},null,2))}
          <h3>PHP verification handler</h3>${code(webhookHandler)}
          <div class="doc-note">Always verify the signature against the exact raw request body before updating your database. Also match order ID and amount and make fulfillment idempotent.</div>
        `)}

        ${extraSection('⚠️', 'Error Handling', 'HTTP status codes and the common error response format.', `
          ${code(JSON.stringify({status:false,message:'Error Message'},null,2))}
          <table class="doc-table"><thead><tr><th>HTTP</th><th>Meaning</th><th>Typical cause</th></tr></thead><tbody>
            <tr><td>400</td><td>Bad request</td><td>Invalid amount, order_id, or redirect_url.</td></tr>
            <tr><td>401</td><td>Unauthorized</td><td>Missing, invalid or inactive API token.</td></tr>
            <tr><td>404</td><td>Not found</td><td>Order does not belong to the authenticated merchant or does not exist.</td></tr>
            <tr><td>409</td><td>Conflict</td><td>Duplicate order_id.</td></tr>
            <tr><td>500</td><td>Server error</td><td>Unexpected backend failure.</td></tr>
          </tbody></table>
          <div class="doc-note">Treat <b>status: true</b> as an API-call success, not automatically as a payment success. Payment completion is represented by <b>result.txnStatus === "SUCCESS"</b>.</div>
        `)}

        ${extraSection('🛡️', 'Production Security Checklist', 'Use these rules before going live.', `
          <div class="doc-rules">
            <div><b>✓ Keep API tokens server-side</b><span>Never expose merchant credentials in browser JavaScript or public apps.</span></div>
            <div><b>✓ Keep Instance Secret private</b><span>Use it only on the server for webhook verification.</span></div>
            <div><b>✓ Verify amount and order ID</b><span>Never fulfill an order from a client-supplied success flag.</span></div>
            <div><b>✓ Make webhook processing idempotent</b><span>Repeated notifications must not create duplicate fulfillment.</span></div>
            <div><b>✓ Use HTTPS</b><span>Use HTTPS for production redirect and webhook URLs.</span></div>
          </div>
        `)}
      </div>`;

    app.insertAdjacentHTML('beforeend', body);
    normalizeDocs();
  }

  // Keep the current documentation intact and add the extended reference after
  // the existing renderer finishes. This avoids replacing the working page.
  const originalDocsPage = window.docsPage;
  if (typeof originalDocsPage === 'function') {
    window.docsPage = async function () {
      await originalDocsPage.apply(this, arguments);
      normalizeDocs();
      appendExtendedReference();
    };
  }
})();
