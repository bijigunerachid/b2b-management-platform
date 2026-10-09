# B2B Management Platform

[![CI](https://github.com/bijigunerachid/b2b-management-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/bijigunerachid/b2b-management-platform/actions/workflows/ci.yml)

A full-stack web application for managing business customers, products, categories, orders, and users through a centralized dashboard.

## Features

* **Dashboard:** Revenue and order-volume charts for the last six months, orders-by-status breakdown, top products, low-stock alerts, and recent activity.
* **Customer Management:** Sortable table or card grid, country filter, CSV export, and a profile drawer with order history and lifetime value.
* **Product Management:** Server-side search, filters (category, active, low stock) and sorting, stock meters, quick activate/deactivate, and CSV export.
* **Category Management:** Card grid with product counts and catalog share; jump straight to a category's products.
* **Order Management:** Status tabs with counts, date-range filter, status timeline, one-click status changes, and an order builder with live totals and stock checks.
* **User Management:** Role picker, password strength meter, and safe account activation/deactivation.
* **Command palette:** Press `Ctrl+K` / `⌘K` to jump to any page, run quick actions, or search customers, products, and orders.
* **Notifications:** Bell menu for low stock, pending orders, and new orders, with read tracking.
* **Polished UI:** Animated modals, drawers, confirm dialogs and toasts; collapsible sidebar; light/dark theme that follows the OS by default; responsive down to phone width.
* **Authentication:** Login and logout using JWT authentication stored in an HttpOnly cookie.
* **Role-Based Access Control:** Admin, Manager, and Employee permissions, enforced by the API and reflected in the UI (actions a role can't perform are hidden).
* **Input Validation:** Validate incoming data and reject invalid operations.

## Technologies

### Frontend

* React
* Vite
* JavaScript
* Tailwind CSS
* React Router

### Backend

* Node.js
* Express.js
* MySQL2
* JWT
* bcrypt

### Database

* MySQL

## Project Structure

```text
b2b-management-platform/
├── .github/workflows/      # CI: tests, audit, lint, build
├── deploy/Caddyfile        # HTTPS reverse proxy for production
├── docker-compose.yml      # MySQL + API + nginx stack
├── docker-compose.prod.yml # adds Caddy with automatic HTTPS
├── .env.example            # settings for docker compose
├── backend/
│   ├── .env.example        # documented environment variables
│   ├── Dockerfile
│   └── src/
│       ├── __tests__/      # Jest + Supertest suites
│       ├── config/         # database pool, env checks, security settings
│       ├── controllers/    # request handlers
│       ├── middleware/     # auth, roles, validation, security, errors
│       ├── routes/         # Express routers
│       ├── scripts/        # migrate, create-admin, seed:large
│       ├── seed/           # demo data generator
│       ├── validation/     # request validation rules
│       └── server.js
├── database/
│   ├── schema.sql          # tables and roles
│   ├── seed.sql            # small sample dataset
│   └── migrations/         # incremental schema changes
├── frontend/
│   ├── .env.example        # VITE_API_URL
│   ├── Dockerfile          # build, then serve with nginx
│   ├── nginx/              # server config and security headers
│   └── src/
│       ├── components/     # app shell, UI kit (modals, toasts, drawers)
│       ├── config/         # company details printed on invoices
│       ├── context/        # auth and theme providers
│       ├── lib/            # API client, formatting, invoices, tables
│       └── pages/
└── README.md
```

## Installation

### Prerequisites

* Node.js 22 and npm
* MySQL 8
* Git

### 1. Clone the repository

```bash
git clone https://github.com/bijigunerachid/b2b-management-platform.git
cd b2b-management-platform
```

### 2. Create the database

```bash
mysql -u root -p < database/schema.sql
```

This creates the `b2b_management` database, all tables, and the Admin, Manager, and Employee roles.

### 3. Configure and start the backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`: set `DB_PASSWORD`, and replace `JWT_SECRET` with a random value:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Apply database migrations, then start the API on `http://localhost:5000`:

```bash
npm run migrate
npm run dev
```

### 4. Create the first admin account

In `backend/.env`, temporarily uncomment `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters), then run:

```bash
npm run create-admin
```

Remove both lines from `.env` afterwards. The server prints a warning while `ADMIN_PASSWORD` is still set.

### 5. Configure and start the frontend

In another terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173` and sign in with your admin account. `VITE_API_URL` in `.env.local` points the frontend at the backend; the default matches step 3.

### Optional: load demo data

Fill the database with a large, realistic dataset (400 customers, 350 products, 5,000 orders over 18 months, 24 team members):

```bash
cd backend
npm run seed:large
```

Customize volumes with `npm run seed:large -- --orders=20000 --customers=1000`. The script appends inside one transaction. `--reset` first deletes **all** customers, products, categories, and orders (real user accounts are kept). Seeded users use the `@seed.b2b.local` domain and share one password, printed once; set `SEED_USER_PASSWORD` in `.env` to choose it.

## Deployment (Docker)

The stack runs as three containers. Only nginx is exposed; the API and database stay on a private network.

```text
browser ──► nginx (frontend)  ── /        → built React app
                              └─ /api/*   → backend (Node.js) ──► MySQL 8
```

Serving the app and API from one origin keeps the session cookie first-party (`SameSite=Strict`) and avoids CORS entirely.

### Run locally

```bash
cp .env.example .env        # fill in the three secrets
docker compose up -d --build
```

Open `http://localhost:8080`. On first start MySQL loads `database/schema.sql`, and the backend applies migrations before it starts.

Create the first admin and, optionally, demo data:

```bash
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a-strong-password-1' backend npm run create-admin
docker compose exec backend npm run seed:large
```

### Deploy to a server with HTTPS

On any Linux VPS with Docker installed and a DNS record pointing your domain at it:

```bash
git clone https://github.com/bijigunerachid/b2b-management-platform.git
cd b2b-management-platform
cp .env.example .env        # set secrets, DOMAIN, and PUBLIC_URL=https://<DOMAIN>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

[Caddy](https://caddyserver.com) obtains and renews the TLS certificate automatically. Health is exposed at `/api/health`, which is useful for uptime monitors.

### What the containers enforce

* Backend runs as a non-root user, applies idempotent migrations on start, and only becomes healthy once the database answers.
* The API connects with a dedicated MySQL account, never root; the database has no published port.
* nginx serves hashed assets with long-term caching, never caches `index.html`, and sends a strict Content-Security-Policy (no inline scripts), `X-Frame-Options: DENY`, and related headers.
* Compose refuses to start when a required secret is missing.

## Testing

```bash
cd backend && npm test          # 52 API, security, and data-generator tests
cd frontend && npm run lint     # ESLint, including React hooks rules
```

GitHub Actions runs the backend tests, a dependency audit, and the frontend lint and production build on every push and pull request.

## API Routes

| Resource       | Endpoint          |
| -------------- | ----------------- |
| Authentication | `/api/auth`       |
| Users          | `/api/users`      |
| Customers      | `/api/customers`  |
| Products       | `/api/products`   |
| Categories     | `/api/categories` |
| Orders         | `/api/orders`     |
| Dashboard      | `/api/dashboard`  |

## Security

* **Passwords:** bcrypt (cost 12); minimum 10 characters with a letter and a number, max 72 bytes.
* **Sessions:** HS256 JWT in an `HttpOnly`, `SameSite=Strict` cookie (`Secure` in production), 1-hour lifetime.
* **Revocation:** each user has a `token_version`. Logout, password change, role change, and deactivation bump it, ending every existing session instantly.
* **Login protection:** rate limited per account (5 failures / 15 min) and per IP (30 / 15 min); constant-time responses that never reveal whether an email exists.
* **CSRF:** state-changing requests must come from an allowed `Origin`/`Referer`, on top of `SameSite=Strict`.
* **Headers:** Helmet with a locked-down CSP, `nosniff`, frame protection; `X-Powered-By` removed; API responses are `Cache-Control: no-store`.
* **Input:** every write route validates types, lengths, and ranges; bodies are limited to 100 KB; all SQL is parameterized and sort columns are whitelisted.
* **Authorization:** roles are read from the database on every request (never trusted from the token); the last active admin can't be demoted or deactivated.
* **Secrets:** environment variables keep credentials out of source code; the server refuses to start with a short `JWT_SECRET`.

### Security configuration

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Enables `Secure` cookies and stricter startup checks |
| `CORS_ORIGIN` | Comma-separated frontend origins (required in production, `https://` only) |
| `TRUST_PROXY` | Set (e.g. `1`) when running behind a reverse proxy so rate limits see real client IPs |

After pulling these changes, apply the database migration once:

```bash
cd backend
npm run migrate
```

## Project Status

Under development. Features and testing are being improved incrementally.

## Author

**Rachid Bijigune**

Full-Stack Development | Big Data

GitHub: https://github.com/bijigunerachid
