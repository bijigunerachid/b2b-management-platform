# B2B Management Platform

[![CI](https://github.com/bijigunerachid/b2b-management-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/bijigunerachid/b2b-management-platform/actions/workflows/ci.yml)

A back office for a wholesale business, plus a portal where its clients can order on their own.

It started as a simple CRUD app (customers, products, orders) and I kept adding the parts a real distributor would need: quotes, invoices with VAT, payments and receivables, a stock ledger with purchase orders, and a client portal. Prices are in MAD and invoices use the Moroccan 20% VAT rate.

On top of that sit three machine-learning models trained on the company's own history (a demand forecast that sizes reorders, a late-payment risk score for open invoices, and product recommendations per customer), and a help assistant that explains the app in English, French or Arabic.

![Dashboard](docs/screenshots/02-dashboard.png)

## What it does

On the staff side you can:

- prepare quotes with negotiated prices, send them, and turn accepted ones into orders (the order keeps the quoted prices)
- set prices per customer: price lists (Gold, −6%), volume discounts from a quantity, and fixed contract prices. Orders, quotes and the client portal all get the same price from one function, and each order line keeps the catalog price and the rule that was applied, so the invoice shows the discount
- follow orders from pending to completed and print A4 invoices
- record payments, including partial ones, and see who owes what in a receivables report grouped by how late it is, with a model's estimate of which invoices will be paid late and why
- see products each customer hasn't bought yet but probably needs, with the reason, in the customer drawer and on the client portal
- take back goods from a delivered order: the credit note lowers what the client owes (or records a refund if they already paid), and items in good condition go back into stock
- track stock through a ledger: every sale, cancellation, delivery and correction is a separate entry with the resulting balance
- order from suppliers, receive deliveries into stock, and get reorder suggestions sized from a demand forecast (see [Machine learning](#machine-learning))
- see sales and gross margin by month, product, customer and category for any date range, compared with the period before, and export each table to CSV. Every order line stores what the goods cost when they were sold (a weighted average updated on each delivery), so margins stay correct when costs change. Costs and reports are only visible to roles allowed to see them

A help assistant on every page explains the app and answers questions, with or without Claude (see [Help assistant](#help-assistant)).

The whole interface, staff and client side, is available in English, French and Arabic, including the printed invoices, quotes and credit notes. Arabic uses a right-to-left layout and proper Arabic plural forms, and numbers, dates and amounts follow the language (Moroccan Arabic month names, Latin digits).

Clients get their own login. They can browse the catalog at their own prices, place orders, download their invoices and credit notes, and accept or decline the quotes you send them. They only ever see their own company's data.

Staff accounts have one of five roles: Admin, Manager, Accountant (payments, returns, reports, read-only elsewhere), Warehouse (stock, deliveries and moving orders along, no money) and Employee (read-only). Clients use the portal. Every change and every sign-in attempt goes into an audit log with who did it, when, and the old and new values of edited fields. Orders and customers show their own history.

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

Sales and margin by month, with cost and margin stacked:

![Reports](docs/screenshots/13-reports.png)

Customer prices in the order form: a contract price on one line, a price list plus a volume discount on the other:

![Customer pricing](docs/screenshots/14-order-pricing.png)

Returning part of a delivered order. Damaged items can be written off instead of going back into stock:

![Return](docs/screenshots/15-return.png)

The audit log, filtered to one warehouse employee, with old and new values:

![Audit log](docs/screenshots/16-audit-log.png)

What each role can do:

![Roles](docs/screenshots/17-roles.png)

The client portal:

![Portal home](docs/screenshots/11-portal-home.png)
![Portal cart](docs/screenshots/12-portal-cart.png)

The interface also comes in French and Arabic. Arabic switches the whole layout to right to left:

![Arabic](docs/screenshots/18-arabic.png)

The demand forecast page, comparing the model with simple rules on weeks it never saw:

![Demand forecast](docs/screenshots/19-demand-forecast.png)

Late-payment risk on open invoices, with the reasons behind one score:

![Payment risk](docs/screenshots/20-payment-risk.png)

Recommendations on the client portal, each with a reason anyone can check:

![Recommendations](docs/screenshots/21-recommendations.png)

The help assistant answering a question, typo included:

![Help assistant](docs/screenshots/22-help-assistant.png)

There's also a dark mode and a Ctrl+K search that jumps to any page or record:

![Dark mode](docs/screenshots/03-dashboard-dark.png)
![Search](docs/screenshots/10-command-palette.png)

## Stack

React 19 with Vite and Tailwind on the frontend, Node.js 22 and Express 5 on the backend, MySQL 8 for the database. The three machine-learning models are trained in Python with pandas and scikit-learn. Tests use Jest, Supertest, pytest and Playwright, and everything runs in Docker for deployment (nginx in front, Caddy for HTTPS).

## How it's put together

In production nginx serves the React build and forwards `/api` to the Node API, which talks to MySQL. Because the frontend and the API share one domain, the login cookie can stay `SameSite=Strict` and I didn't need any CORS setup.

```text
browser -> nginx -> React app
                 -> /api -> Express -> MySQL <- Python training job (ml/)
```

A few things I spent time on:

- Stock can only change through one function. `recordMovement()` updates the product and writes a ledger row in the same transaction. Sales, cancellations, deliveries and manual corrections all go through it, so the history always adds up to the current stock.
- Race conditions: converting a quote, receiving a delivery or recording a payment locks the row first (`SELECT ... FOR UPDATE`). Clicking "convert" twice at the same moment creates one order, not two. Products are always locked in the same order to avoid deadlocks.
- Totals are added up in cents, and VAT is calculated once per invoice the same way on the server and on the printed document. Statuses like "overdue" or "expired" are worked out from the dates each time instead of being stored, so they can't get out of date.
- The default auth middleware only lets staff through, so every internal route rejects portal accounts without me having to remember it route by route. Portal queries always filter by the company stored in the session.
- Logging out, changing a password or role, or being deactivated invalidates every session that user has, not just the current cookie.
- Permissions are one table in `backend/src/config/permissions.js`. Routes check permissions (`requirePermission("orders.fulfil")`), never role names, and the signed-in user's list is sent to the frontend, so the menus and buttons can't disagree with the server.
- The audit log is written by one middleware after a change succeeds, so a new endpoint is logged even if I forget about it. Controllers only add the old/new values. Passwords and tokens are stripped before anything is stored, and the API has no way to edit or delete entries.
- Translations use the English text as the key (`t("Create order")`), so anything untranslated falls back to readable English. `npm run i18n:check` reads the source and fails CI if any text is missing its French or Arabic version. Layout classes use start/end instead of left/right, so the right-to-left version comes from the same markup.

The billing, quote and purchasing rules live in plain modules with no database code, which made them easy to unit test.

## Machine learning

Three models trained on the company's own history help with stock, collections and sales. All three are trained offline in Python (`ml/`), tested against simple rules on data they never saw, and write their results to MySQL. The API only reads those tables, so the app doesn't need Python and keeps working if a job has never run. Managers can see each model's test results in the app.

### Demand forecast

Predicts how many units of each product will sell in the next 4 weeks, with an 80% range. Purchasing uses it: a product is suggested for reordering when its stock plus what's on order falls below the expected sales during the supplier's lead time, plus safety stock taken from the upper end of the range. The manual reorder point stays as a minimum. Each product's stock drawer shows its recent weekly sales and the forecast.

- **Model:** gradient-boosted trees (scikit-learn `HistGradientBoostingRegressor`) with a Poisson loss for the expected units, plus two quantile models for the 10% and 90% bounds.
- **Inputs:** each product's recent weekly sales, its 13/26/52-week averages, the same weeks last year, and its category's seasonal pattern pooled across all products in the category (single products sell too rarely to show a season on their own). Price and month are also used.
- **Testing:** a rolling backtest. For each of the last six 4-week periods, the model is retrained only on data from before that period and compared with what actually sold.

| Method (1,911 product forecasts) | WAPE | RMSE | Bias |
|---|---:|---:|---:|
| **Model** | **67.8%** | **22.52** | +0.3% |
| Yearly average × category season | 69.5% | 23.86 | −25.2% |
| 13-week average | 71.9% | 25.05 | +3.7% |
| Last 4 weeks again | 76.6% | 27.42 | −2.8% |
| Same weeks last year | 80.7% | 28.61 | −23.5% |

The model has 5.6% lower RMSE than the best simple method and is almost unbiased. I rank by RMSE because the model predicts expected sales, which is what reordering needs. WAPE rewards forecasts that run low when demand is lumpy (more than half of all 4-week windows sell nothing for a given product): the seasonal average comes close on WAPE only by forecasting 25% too little, which would leave the warehouse short. 10.1% of actual sales landed above the upper bound, against a 10% target.

### Late-payment risk

For every open invoice that isn't late yet, estimates the probability it will be paid more than 7 days after its due date. The Receivables page shows the score next to each invoice with the reasons in plain words ("paid late on 12 of 15 earlier invoices", "large invoice"), a filter for invoices that are likely to be late, and their total.

- **Model:** logistic regression on six inputs: how often the customer paid late before, how late their recent payments were, how many of their invoices were already overdue, invoice size, whether it's August or December, and whether the customer is new. Gradient-boosted trees on all 18 features I computed scored slightly worse, and a linear model can explain each score exactly, so I kept it.
- **No leakage:** every input is computed as of the day the invoice was issued. An earlier invoice only counts as late or on time once its own deadline had passed, and a test rewrites later payments to check that nothing earlier changes.
- **Testing:** for each of the last six complete months, the model is trained only on invoices whose outcome was known at the start of that month, then scores the invoices issued during it.

| Method (1,386 invoices, 36.8% paid late) | Brier score | AUC | Log loss |
|---|---:|---:|---:|
| **Logistic regression** | **0.1129** | **0.903** | **0.361** |
| Gradient-boosted trees | 0.1176 | 0.896 | 0.378 |
| The customer's past late rate | 0.1207 | 0.883 | 0.384 |
| Same rate for every invoice | 0.2327 | 0.491 | 0.658 |

The main score is the Brier score, because the app shows probabilities and they should mean what they say: the model's is 6.5% lower than the "how often did this customer pay late before" rule a credit controller would use. Split into five groups by predicted risk, the predicted and actual late rates match within 5 points (for example 21% predicted, 23% late).

### Product recommendations

For each customer, up to 10 products they haven't bought yet but are likely to need. Staff see them in the customer drawer, and clients see them on the portal home page at their own prices, ready to add to the cart. Each suggestion says why, as a fact anyone can check: "bought by 49% of customers who buy Hand Sanitizer Industrial", shown only when enough customers bought both and the pair is clearly more common than chance, or "popular in the categories you buy".

- **Model:** EASE (Steck, 2019), a closed-form linear model that learns how much buying one product says about buying another, blended with the popularity of products in the categories the customer buys from. That part helps customers with a short history.
- **Testing:** four 60-day periods. For each one, only purchases from before it are used to make 10 suggestions per customer, then the suggestions are compared with what each customer bought for the first time during the period. Products they already reorder don't count, because suggesting those is easy and useless.

| Method (457 customer checks) | Found (recall@10) | At least one hit | NDCG@10 |
|---|---:|---:|---:|
| **EASE + category popularity** | **30.9%** | **45.3%** | **0.205** |
| EASE alone | 29.2% | 43.3% | 0.199 |
| Popular in the customer's categories | 26.0% | 38.3% | 0.170 |
| Best sellers for everyone | 25.7% | 39.2% | 0.166 |
| Similar products (item-to-item cosine) | 22.4% | 34.1% | 0.151 |

The model finds 19% more of the products customers went on to buy than the best simple rule, and 45% of customers bought at least one of their 10 suggestions within 60 days. Best sellers are a hard rule to beat here because a few products account for much of the demand.

### What these numbers mean

All three models were tested on generated data, and I built the patterns into the generator: seasons per category, slow trends and an August slowdown for sales; for payments, each customer has habits (early, on time, slow or erratic, some getting worse over time), large invoices and August/December invoices are paid later, and 7% of invoices get stuck in a dispute; for buying, each customer has a line of business (office, IT, logistics, hospitality, facilities) that decides which categories they buy from, they reorder their usual products, and equipment is followed by what it uses (printers by toner, espresso machines by coffee). The results show the pipelines find patterns that are really there. They don't predict how well the models would do on a real company's data. I also chose the model settings on the same test periods, so the margins over the simple rules are slightly optimistic. The demo data is generated relative to today's date, so the exact numbers change a little each time you seed it: over several fresh seeds the forecast beat the best simple method by 4–9% (RMSE), the risk model by 6–7% (Brier score) and the recommendations by 13–19% (recall). The tables above are from one of those runs.

### Training

Python 3.11 or newer:

```bash
cd ml
python -m venv .venv
.venv/Scripts/activate        # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m b2b_ml forecast --dry-run   # train and print the test results only
python -m b2b_ml forecast             # also publish the forecasts to the app
python -m b2b_ml risk                 # same for the late-payment model
python -m b2b_ml recommend            # same for product recommendations
```

The jobs read the database settings from `backend/.env`. In production you'd run them weekly from cron. More detail is in [ml/README.md](ml/README.md).

## Help assistant

A help button on every page, for staff and portal clients, opens a small chat. "Explain this page" describes the page you're on, and you can ask questions in English, French or Arabic ("how do I record a partial payment?", "comment faire un avoir ?"). Answers come with numbered steps and a link that opens the right page.

It answers from a help guide I wrote: 36 short articles in three languages about every page and task. Staff only get articles their role allows (an Employee isn't told how to manage users), and clients only get portal help.

It works in two modes:

- **Built-in search (default, free).** The API finds the article that answers the question with TF-IDF over whole words and 3-letter pieces of words, so typos ("paymnt", "facure") and word forms still match, in all three languages at once. Off-topic questions get "I couldn't find that" instead of a random article. On 107 test questions written separately from the guide (with typos, French and Arabic), the right article comes first 87% of the time for staff questions and 100% for client questions, and is in the top three 99% and 100% of the time. I wrote and adjusted the guide while looking at these questions, so treat those numbers as optimistic. A test keeps them from getting worse.
- **Claude (optional).** With `ANTHROPIC_API_KEY` set, Claude (`claude-haiku-5-5` by default) writes a conversational answer using only the articles search found, in the user's language, and lists the articles it used. It never receives business data: only the question, the last few turns of the conversation and the help articles. Each user can ask 30 questions an hour, and `ASSISTANT_DAILY_LIMIT` (300 by default) caps the total per day. Past either limit, or if Claude fails, the helper falls back to search, so it always answers.

Questions to the helper aren't written to the audit log.

## Running it locally

You need Node.js 22, MySQL 8 and Git, and Python 3.11+ only if you want to train the models.

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

This fills the database with about 400 customers, 350 products and 5,000 orders over 24 months, with seasonal patterns per category (back-to-school office supplies, year-end electronics, a quiet August) and customers with their own line of business, buying habits and payment habits, so the models have something to learn. It also adds the matching payments, quotes, returns, price lists, suppliers, purchase orders, 24 staff accounts and 3 client logins (`buyer@<company>.portal.example`). They all share one password, which is printed at the end. You can set it yourself with `SEED_USER_PASSWORD` in `.env`.

Other options:

- `npm run seed:large -- --orders=20000` to change the volumes
- `npm run seed:large -- --reset` to wipe customers, products, orders and everything linked to them first (your real accounts are kept)
- `npm run seed:payments`, `seed:quotes`, `seed:purchasing`, `seed:portal`, `seed:returns`, `seed:pricing`, `seed:roles` to add just one part to an existing database. Running them twice is safe.

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

The model training jobs have their own image. They aren't started by `up`; run one whenever you want fresh results:

```bash
docker compose --profile ml run --rm ml forecast
docker compose --profile ml run --rm ml risk
docker compose --profile ml run --rm ml recommend
```

On a server, a weekly cron entry does it, for example `0 3 * * 1 cd /srv/b2b && docker compose --profile ml run --rm ml forecast`.

## Tests

```bash
cd backend && npm test      # 243 Jest tests (business rules, permissions, audit, security, help search)
cd frontend && npm run lint
cd ml && python -m pytest   # 27 tests (no data leakage, metrics, backtests on synthetic data)
cd e2e && npm ci && npx playwright install chromium && npx playwright test
```

The browser tests (Playwright) go through the app the way people use it: signing in as each role, creating an order, moving it to completed, recording the payment, opening the invoice, taking a return, turning a quote into an order, ordering from the client portal, asking the help assistant, and finding all of it in the audit log. They also check that each role only sees what it should.

They never touch your data. Each run builds a separate `b2b_e2e` database (schema, migrations, a small seed, one account per role) and starts the API and the app on their own ports (5055 and 5175). The script refuses to reset any database whose name doesn't start with `b2b_e2e`. Database settings come from `backend/.env`.

GitHub Actions runs all four on every push and pull request, along with `npm audit`, `pip-audit`, the translation check, a production build and a build of every Docker image. The browser tests run against a MySQL 8.4 service, and the report is uploaded when they fail.

## Security notes

- Passwords are hashed with bcrypt and need at least 10 characters including a letter and a number.
- Login is rate limited per account and per IP, and gives the same answer whether or not the email exists.
- The session is a JWT in an HttpOnly cookie that expires after an hour.
- Write requests from other origins are rejected (CSRF), and nginx sends a strict Content Security Policy.
- All SQL is parameterized, and request bodies are validated and size-limited.
- Failed sign-ins are recorded in the audit log with the email that was tried.

For production, set `NODE_ENV=production`, `CORS_ORIGIN` (https only) and, behind a proxy, `TRUST_PROXY`.

## Known limitations

- Rate limits are kept in memory, so they won't be shared if you run more than one API instance.
- There's one currency and one VAT rate. Prices are stored excluding VAT.
- Costs only exist from migration 008 on. Older order lines got the product's cost at that time, and products never bought from a supplier got an estimate, so margins on old data are approximate.
- The Ctrl+K product search only looks at the first 100 products.
- Messages that come from the server (most validation errors, the price label on an order line) are still in English, and so is the demo data.
- The help assistant's usage limits are kept in memory, like the rate limits. The help guide is written by hand, so it has to be updated when a page changes.
- Customers and orders are paginated in the browser, which is fine for a few thousand rows but won't scale forever.
- The models are only as fresh as their last training run, and nothing schedules them for you. Products with no sales yet get no forecast and fall back to the reorder point. Risk scores are worked out as of the day each invoice was issued and don't update when the customer pays something else later. New customers get recommendations only after their first order.

## What I'd add next

- Server messages in French and Arabic too, picked from the request's `Accept-Language`
- Emails: send quotes and invoices to clients, and remind them before an invoice falls due
- A public demo with read-only accounts for each role

## Author

Rachid Bijigune ([@bijigunerachid](https://github.com/bijigunerachid))
