# OmniUPI Architecture

## Production domains

- Website / merchant panel: `https://omniupi.in`
- API: `https://api.omniupi.in`
- Admin panel: `https://admin.omniupi.in`
- Documentation: `https://omniupi.in/docs`

## Panels

- Merchant panel: account, merchants, payment links, transactions, API/webhooks, plans and support.
- Admin panel: users, merchants, payment configuration, transactions, plans, security, support and audit views.

## API

All merchant/admin application API requests use:

`https://api.omniupi.in/api/v1`

Health check:

`https://api.omniupi.in/health`

## Payment lifecycle

1. Merchant creates an order through the OmniUPI server-side API.
2. OmniUPI creates a pending transaction and a hosted checkout/payment URL.
3. Customer completes payment using an enabled and authorized payment method.
4. A provider-authorized verification mechanism confirms the transaction.
5. The transaction is updated idempotently with the verified amount/reference.
6. A signed webhook is delivered to the merchant endpoint.
7. Merchant can also query the order status API.

## Merchant integrations

Provider-specific adapters belong under `backend/src/services/providers/`. Each adapter must use an authorized integration method. Never collect or store payment-account passwords or attempt to bypass provider authentication.

Google-linked integrations must use OAuth authorization and encrypted server-side token storage where permitted by the provider's terms. Request the minimum scopes necessary.

## Security requirements

- Secrets only in environment/secret storage.
- Hash user passwords with a modern password hashing algorithm.
- Secure, HttpOnly cookies for browser sessions.
- CSRF protection where cookie-authenticated state changes are used.
- Rate-limit authentication and payment endpoints.
- Verify webhook signatures and timestamps.
- Make payment/order updates idempotent.
- Never trust a client-provided payment-success flag.
- Log security/audit events without storing sensitive credentials.
