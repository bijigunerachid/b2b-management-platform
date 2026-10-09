# B2B Management Platform

[![CI](https://github.com/bijigunerachid/b2b-management-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/bijigunerachid/b2b-management-platform/actions/workflows/ci.yml)

A back office for a wholesale business, plus a portal where its clients can order on their own.

It started as a simple CRUD app (customers, products, orders) and I kept adding the parts a real distributor would need: quotes, invoices with VAT, payments and receivables, a stock ledger with purchase orders, and a client portal. Prices are in MAD and invoices use the Moroccan 20% VAT rate.

![Dashboard](docs/screenshots/02-dashboard.png)

## What it does

On the staff side you can:

- prepare quotes with negotiated prices, send them, and turn accepted ones into orders (the order keeps the quoted prices)
- follow orders from pending to completed and print A4 invoices
- record payments, including partial ones, and see who owes what in a receivables report grouped by how late it is
- take back goods from a delivered order: the credit note lowers what the client owes (or records a refund if they already paid), and items in good condition go back into stock
- track stock through a ledger: every sale, cancellation, delivery and correction is a separate entry with the resulting balance
- order from suppliers, receive deliveries into stock, and get reorder suggestions based on recent sales

Clients get their own login. They can browse the catalog, place orders, download their invoices and credit notes, and accept or decline the quotes you send them. They only ever see their own company's data.

There are four roles: Admin, Manager, Employee (read-only on most things) and Customer (portal only).

## Screenshots

Quote with a discount against list price, ready to convert:

![Quote](docs/screenshots/06-quote.png)

An order with a partial payment:

![Order](docs/screenshots/04-order-drawer.png)

The printable invoice:

![Invoice](docs/screenshots/07-invoice.png)

Receivables, grouped by how overdue they are:

![Receivables](docs/screenshots/05-receivables.png)

Reorder suggestions, grouped by supplier, and a purchase order that's late:

![Reorder suggestions](docs/screenshots/08-reorder-suggestions.png)
![Purchase order](docs/screenshots/09-purchase-order.png)

The client portal:

![Portal home](docs/screenshots/11-portal-home.png)
![Portal cart](docs/screenshots/12-portal-cart.png)

There's also a dark mode and a Ctrl+K search that jumps to any page or record:

![Dark mode](docs/screenshots/03-dashboard-dark.png)
![Search](docs/screenshots/10-command-palette.png)

## Stack

React 19 with Vite and Tailwind on the frontend, Node.js 22 and Express 5 on the backend, MySQL 8 for the database. Tests use Jest and Supertest, and everything runs in Docker for deployment (nginx in front, Caddy for HTTPS).

## How it's put together

In production nginx serves the React build and forwards `/api` to the Node API, which talks to MySQL. Because the frontend and the API share one domain, the login cookie can stay `SameSite=Strict` and I didn't need any CORS setup.

```text
browser -> nginx -> React app
                 -> /api -> Express -> MySQL
```

A few things I spent time on:

- Stock can only change through one function. `recordMovement()` updates the product and writes a ledger row in the same transaction. Sales, cancellations, deliveries and manual corrections all go through it, so the history always adds up to the current stock.
- Race conditions: converting a quote, receiving a delivery or recording a payment locks the row first (`SELECT ... FOR UPDATE`). Clicking "convert" twice at the same moment creates one order, not two. Products are always locked in the same order to avoid deadlocks.
- Totals are added up in cents, and VAT is calculated once per invoice the same way on the server and on the printed document. Statuses like "overdue" or "expired" are worked out from the dates each time instead of being stored, so they can't get out of date.
- The default auth middleware only lets staff through, so every internal route rejects portal accounts without me having to remember it route by route. Portal queries always filter by the company stored in the session.
- Logging out, changing a password or role, or being deactivated invalidates every session that user has, not just the current cookie.

The billing, quote and purchasing rules live in plain modules with no database code, which made them easy to unit test.

## Running it locally

You need Node.js 22, MySQL 8 and Git.

```bash
git clone https://github.com/bijigunerachid/b2b-management-platform.git
cd b2b-management-platform
mysql -u root -p < database/schema.sql
```

Backend:

```bash
cd backend
npm install
cp .env.example .env
```

In `backend/.env`, set `DB_PASSWORD` and put a long random string in `JWT_SECRET`. This prints one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then:

```bash
npm run migrate
npm run dev
```

The API runs on http://localhost:5000.

To create the first admin, temporarily uncomment `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (12+ characters), run `npm run create-admin`, then remove those two lines again. The server warns you if you forget.

Frontend, in another terminal:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173 and sign in.

### Demo data

```bash
cd backend
npm run seed:large
```

This fills the database with about 400 customers, 350 products and 5,000 orders over 18 months. It also adds the matching payments, quotes, returns, suppliers, purchase orders, 24 staff accounts and 3 client logins (`buyer@<company>.portal.example`). They all share one password, which is printed at the end. You can set it yourself with `SEED_USER_PASSWORD` in `.env`.

Other options:

- `npm run seed:large -- --orders=20000` to change the volumes
- `npm run seed:large -- --reset` to wipe customers, products, orders and everything linked to them first (your real accounts are kept)
- `npm run seed:payments`, `seed:quotes`, `seed:purchasing`, `seed:portal`, `seed:returns` to add just one part to an existing database. Running them twice is safe.

## Docker

```bash
cp .env.example .env    # fill in the three secrets
docker compose up -d --build
```

The app is then on http://localhost:8080. On first start MySQL loads the schema and the backend runs the migrations before it starts.

```bash
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a-strong-password-1' backend npm run create-admin
docker compose exec backend npm run seed:large
```

To put it on a server with HTTPS, point a domain at the server, set `DOMAIN` and `PUBLIC_URL=https://<your domain>` in `.env`, and run:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Caddy gets the certificate from Let's Encrypt and renews it automatically. Only the web server is exposed. MySQL has no public port, and the API connects with its own database user rather than root.

## Tests

```bash
cd backend && npm test      # 132 Jest tests
cd frontend && npm run lint
```

GitHub Actions runs both on every push and pull request, along with `npm audit` and a production build.

## Security notes

- Passwords are hashed with bcrypt and need at least 10 characters including a letter and a number.
- Login is rate limited per account and per IP, and gives the same answer whether or not the email exists.
- The session is a JWT in an HttpOnly cookie that expires after an hour.
- Write requests from other origins are rejected (CSRF), and nginx sends a strict Content Security Policy.
- All SQL is parameterized, and request bodies are validated and size-limited.

For production, set `NODE_ENV=production`, `CORS_ORIGIN` (https only) and, behind a proxy, `TRUST_PROXY`.

## Known limitations

- Rate limits are kept in memory, so they won't be shared if you run more than one API instance.
- There's one currency and one VAT rate. Prices are stored excluding VAT.
- The Ctrl+K product search only looks at the first 100 products.
- Customers and orders are paginated in the browser, which is fine for a few thousand rows but won't scale forever.
- No browser tests yet. Everything in CI is API and unit level.

## What I'd add next

- Customer-specific prices and volume discounts
- A French and Arabic interface
- Playwright tests for the main flows

## Author

Rachid Bijigune ([@bijigunerachid](https://github.com/bijigunerachid))
