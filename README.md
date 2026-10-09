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
├── frontend/
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── server.js
├── database/
├── docs/
└── README.md
```

## Installation

### Prerequisites

* Node.js and npm
* MySQL Server
* Git

### 1. Clone the repository

```bash
git clone https://github.com/bijigunerachid/b2b-management-platform.git
cd b2b-management-platform
```

### 2. Configure the database

Create a MySQL database named `b2b_management`.

Run your SQL schema and seed scripts from the `database/` directory, if available.

### 3. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=b2b_management
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
```

Replace the example values with your own configuration. Never commit `.env` to Git.

Start the backend:

```bash
npm run dev
```

### Optional: load demo data

Fill the database with a large, realistic dataset (400 customers, 350 products, 5,000 orders over 18 months, 24 team members):

```bash
cd backend
npm run seed:large
```

Customize volumes with `npm run seed:large -- --orders=20000 --customers=1000`. The script appends inside one transaction. `--reset` first deletes **all** customers, products, categories, and orders (real user accounts are kept). Seeded users use the `@seed.b2b.local` domain and share one password, printed once; set `SEED_USER_PASSWORD` in `.env` to choose it.

### 4. Configure the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually `http://localhost:5173`.

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
