# API routes

Planned route groups:

- `/api/auth` — registration, login, sessions
- `/api/merchants` — merchant/payment-source configuration
- `/api/orders` — create and query payment orders
- `/api/transactions` — transaction history and details
- `/api/webhooks` — signed provider and merchant callbacks
- `/api/plans` — subscription plans
- `/api/admin` — administrator-only operations

The actual payment-provider adapters and verification logic will be implemented only against authorized provider interfaces and documented APIs.
