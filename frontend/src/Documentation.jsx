import React, { useMemo, useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronUp, Copy, Link2, Mail, Search, ShieldCheck, Upload, Webhook, Zap } from 'lucide-react';
import './documentation.css';

// Temporary public URL. When the custom domain is purchased, change only this value.
export const DOCS_SITE_URL = 'https://yourquirey-gif.github.io/automatic-upi-gateway/';

const CREATE_ORDER_URL = `${DOCS_SITE_URL}api/create-order`;
const STATUS_URL = `${DOCS_SITE_URL}api/check-order-status`;

const createParams = [
  ['customer_mobile', 'Integer', 'Customer mobile number'],
  ['user_token', 'string', 'Your API Token'],
  ['amount', 'float', 'Payment amount'],
  ['order_id', 'string', 'Unique order ID'],
  ['redirect_url', 'url', 'Customer redirect URL'],
  ['remark1', 'string', 'Optional remark'],
  ['remark2', 'string', 'Optional remark'],
];

const statusParams = [
  ['user_token', 'string', 'The API Token'],
  ['order_id', 'string', 'The order ID'],
];

const phpCreate = `<?php
$api_url = '${CREATE_ORDER_URL}';

$post_data = [
    'customer_mobile' => '9999999999',
    'user_token'      => 'YOUR_API_TOKEN',
    'amount'          => '1.00',
    'order_id'        => 'ORDER123456',
    'redirect_url'    => 'https://example.com/success',
    'remark1'         => 'testremark',
    'remark2'         => 'testremark2',
];

$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-www-form-urlencoded'
]);

$response = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'cURL Error: ' . curl_error($ch);
} else {
    echo $response;
}
curl_close($ch);
?>`;

const phpStatus = `<?php
$api_url = '${STATUS_URL}';

$post_data = [
    'user_token' => 'YOUR_API_TOKEN',
    'order_id'   => 'ORDER123456'
];

$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-www-form-urlencoded'
]);

$response = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'cURL Error: ' . curl_error($ch);
} else {
    echo $response;
}
curl_close($ch);
?>`;

const phpWebhook = `<?php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Only POST requests are allowed');
}

$received_signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$instance_secret = 'YOUR_INSTANCE_SECRET';
$rawBody = file_get_contents('php://input');

$generated_signature = hash_hmac('sha256', $rawBody, $instance_secret);

if (!hash_equals($generated_signature, $received_signature)) {
    http_response_code(401);
    exit('Invalid Signature');
}

$data = json_decode($rawBody, true);
$status = $data['status'] ?? '';
$order_id = $data['order_id'] ?? '';
$customer_mobile = $data['customer_mobile'] ?? '';
$amount = $data['amount'] ?? '';
$utr = $data['utr'] ?? '';
$remark1 = $data['remark1'] ?? '';
$remark2 = $data['remark2'] ?? '';
$timestamp = $data['timestamp'] ?? '';

// Save to your database and update the order here.
echo 'SUCCESS';
?>`;

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  };
  return <div className="docs-code-wrap"><button className="docs-copy" onClick={copy}><Copy size={15}/> {copied ? 'Copied' : 'Copy'}</button><pre><code>{code}</code></pre></div>;
}

function ParamsTable({ rows, headers = ['PARAMETER', 'TYPE', 'DESCRIPTION'] }) {
  return <div className="docs-table-scroll"><table className="docs-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(([name, type, description]) => <tr key={name}><td><b>{name}</b></td><td>{type}</td><td>{description}</td></tr>)}</tbody></table></div>;
}

function SectionTitle({ icon: Icon, children }) { return <h2 className="docs-section-title"><span><Icon size={21}/></span>{children}</h2>; }

function ResponseBox({ children, error = false }) { return <div className={`docs-response ${error ? 'error' : ''}`}><pre><code>{children}</code></pre></div>; }

export default function Documentation() {
  const [query, setQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const searchable = useMemo(() => query.trim().toLowerCase(), [query]);
  const visibleCreate = searchable ? createParams.filter(r => r.join(' ').toLowerCase().includes(searchable)) : createParams;

  return <div className="documentation-page">
    <header className="docs-topbar">
      <button className="docs-back" onClick={() => { location.hash = 'dashboard'; }}><span>ϟ</span> AutoGateway</button>
      <div className="docs-top-title">Documentation</div>
      <div className="docs-version">v2.0</div>
    </header>

    <main className="docs-main">
      <div className="docs-hero">
        <div><span className="docs-eyebrow">DEVELOPER DOCUMENTATION</span><h1><BookOpen size={28}/> API Gateway Docs</h1><p>Integrate PayIN requests, check payment status and receive real-time webhook notifications.</p></div>
        <a href={DOCS_SITE_URL} target="_blank" rel="noreferrer" className="docs-site-link"><Link2 size={17}/> {DOCS_SITE_URL}</a>
      </div>

      <div className="docs-notice"><ShieldCheck size={20}/><div><b>Temporary site URL</b><span>These docs currently use the GitHub Pages URL above. When your custom domain is purchased, change the single <code>DOCS_SITE_URL</code> value in the source.</span></div></div>

      <section className="docs-card">
        <SectionTitle icon={BookOpen}>Overview</SectionTitle>
        <p>This API allows you to create a PayIN payment request using the AutoGateway platform. Use the API Token shown in <b>Developer Setting → API Details</b> to authenticate requests.</p>
      </section>

      <section className="docs-card">
        <SectionTitle icon={Link2}>Endpoint PayIN API</SectionTitle>
        <div className="endpoint"><b>POST</b><code>{CREATE_ORDER_URL}</code></div>
        <div className="docs-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search request parameters..."/></div>
        <h3>Request Parameters</h3>
        <ParamsTable rows={visibleCreate}/>
        {!searchable && <button className="docs-more" onClick={() => setShowMore(v => !v)}>{showMore ? <>Hide details <ChevronUp size={17}/></> : <>View parameter details <ChevronDown size={17}/></>}</button>}
        {showMore && <div className="docs-tip"><Zap size={18}/><span><b>order_id</b> should be unique for every payment request. Keep it unchanged when checking status or processing a webhook.</span></div>}
      </section>

      <section className="docs-card">
        <SectionTitle icon={Zap}>Example - Create PayIN Request</SectionTitle>
        <h3>Request:</h3><CodeBlock code={phpCreate}/>
        <h3>Response (Success):</h3>
        <ResponseBox>{`{
  "status": true,
  "message": "Order Created Successfully",
  "result": {
    "orderId": "ORDER123456",
    "payment_url": "${DOCS_SITE_URL}payment/pay.php?data=YOUR_PAYMENT_DATA"
  }
}`}</ResponseBox>
        <h3>Error Handling</h3><p>If the response status is <b className="badge-error">ERROR</b>, check the <code>message</code> field for details.</p>
        <ResponseBox error>{`{
  "status": false,
  "message": "Error Message"
}`}</ResponseBox>
      </section>

      <section className="docs-card">
        <SectionTitle icon={Search}>Endpoint for PayIN Status</SectionTitle>
        <div className="endpoint"><b>POST</b><code>{STATUS_URL}</code></div>
        <h3>Request Parameters</h3><ParamsTable rows={statusParams}/>
        <h3>Request Headers</h3><ParamsTable headers={['PARAMETER', 'DESCRIPTION', '']} rows={[[ 'Content-Type', 'Form-Encoded Payload (application/x-www-form-urlencoded)', '' ]]}/>
        <h3>Response</h3><ParamsTable headers={['FIELD', 'TYPE', 'DESCRIPTION']} rows={[
          ['status', 'boolean', 'API request success status.'],
          ['message', 'string', 'API result message.'],
          ['result', 'object', 'Details of transaction.'],
          ['txnStatus', 'string', 'Transaction status.'],
          ['orderId', 'string', 'Order ID.'],
          ['amount', 'string', 'Transaction amount.'],
          ['date', 'string', 'Transaction time.'],
          ['utr', 'string', 'UTR Number.'],
        ]}/>
        <h3>Example - Check PayIN Status</h3><CodeBlock code={phpStatus}/>
        <h3>Response (Success):</h3><ResponseBox>{`{
  "status": true,
  "message": "Transaction Successfully",
  "result": {
    "txnStatus": "SUCCESS",
    "orderId": "ORDER123456",
    "amount": "1.00",
    "date": "2026-08-17 12:00:00",
    "utr": "123456789012"
  }
}`}</ResponseBox>
      </section>

      <section className="docs-card">
        <SectionTitle icon={Webhook}>Webhook</SectionTitle>
        <p>Webhook is used to receive real-time payment notifications. When a payment is successfully completed, the system sends a <b>POST</b> request to your configured webhook URL.</p>
        <h3>Webhook Headers</h3>
        <ParamsTable headers={['HEADER', 'VALUE', 'DESCRIPTION']} rows={[
          ['Content-Type', 'application/json', 'Webhook request body format.'],
          ['X-Webhook-Signature', 'SHA256 HMAC Signature', 'Used to verify the authenticity of the webhook.'],
          ['X-Webhook-Event', 'payment.success', 'Webhook event type.'],
        ]}/>
        <h3>Webhook JSON Payload</h3><ResponseBox>{`{
  "status": "SUCCESS",
  "order_id": "ORDER123456",
  "customer_mobile": "9999999999",
  "amount": "1.00",
  "utr": "123456789012",
  "remark1": "testremark",
  "remark2": "testremark2",
  "timestamp": 1786013741
}`}</ResponseBox>
        <h3>PHP Webhook Handler</h3><CodeBlock code={phpWebhook}/>
        <div className="docs-signature"><ShieldCheck size={22}/><div><b>Signature Verification</b><p>The <code>X-Webhook-Signature</code> is generated using HMAC-SHA256 with your Instance Secret and the original raw JSON payload. Always verify the signature before processing the payment.</p></div></div>
      </section>

      <section className="docs-card docs-footer-card">
        <Mail size={20}/><div><b>Need help?</b><p>Use Support Ticket from the merchant dashboard if you need integration assistance.</p></div>
      </section>
    </main>
  </div>;
}
