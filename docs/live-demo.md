# Running the public live demo

This puts the app online with demo data that anyone can try: the login page offers one-click accounts for every role and for a portal client, visitors can change anything, and the data resets every night. It reuses the production Docker setup (nginx, Caddy for HTTPS, MySQL) and adds a demo mode.

Never turn demo mode on for a real company's data: the demo password is shown on the login page.

## What demo mode changes

With `DEMO_MODE=true`:

- The login page shows "Try the live demo" with six accounts: Admin, Manager, Accountant, Warehouse, Employee and a portal client. They share `DEMO_PASSWORD`, which is shown there.
- Every page shows a thin banner saying the data resets every night.
- Anything that would lock other visitors out is refused: changing a password, creating or editing staff accounts, and giving or removing portal access. Signing out only ends your own session (normally it ends all of that user's sessions).
- `npm run demo:reset` is allowed to wipe and regenerate the data. It refuses to run without demo mode.

## 1. A server and a domain

You need a Linux server with Docker and a domain name pointing at it.

- **Server:** any VPS with 2 GB of RAM or more (MySQL plus the model training). For example a Hetzner CX22 or a DigitalOcean Basic droplet, about 5–6 € a month. Choose Ubuntu 24.04.
- **Domain:** add a DNS `A` record for, say, `demo.yourdomain.com` pointing at the server's IP address. If you don't have a domain, a free subdomain service such as DuckDNS works.
- **Firewall:** allow ports 22 (SSH), 80 and 443.

Free hosting platforms are possible, but the app sleeps when idle, free MySQL plans are small, and there's no easy place for the nightly job. A small VPS is simpler and fits this setup exactly.

## 2. Install Docker

On the server:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then log out and back in
```

## 3. Get the code and configure it

```bash
sudo mkdir -p /srv/b2b && sudo chown $USER /srv/b2b
git clone https://github.com/bijigunerachid/b2b-management-platform.git /srv/b2b
cd /srv/b2b
cp .env.example .env
```

Generate the secrets (run it three times):

```bash
openssl rand -hex 32
```

Then edit `.env`:

```bash
MYSQL_ROOT_PASSWORD=<first secret>
DB_PASSWORD=<second secret>
JWT_SECRET=<third secret>

DOMAIN=demo.yourdomain.com
PUBLIC_URL=https://demo.yourdomain.com

DEMO_MODE=true
DEMO_PASSWORD=TryTheDemo2026      # public: at least 10 characters, a letter and a number
DEMO_RESET_TIME=03:00 UTC         # shown to visitors; match the cron time below

# Optional: AI answers in the help assistant. Keep the daily cap low on a public demo.
# ANTHROPIC_API_KEY=
# ASSISTANT_DAILY_LIMIT=100
```

Without `ANTHROPIC_API_KEY` the help assistant still works, answering from its built-in help guide. With a key, every question can cost a little, so keep the daily cap low.

## 4. Start it

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The first start takes a few minutes. Caddy gets the HTTPS certificate from Let's Encrypt on its own once the DNS record points at the server.

## 5. Load the demo data and train the models

```bash
./deploy/demo-reset.sh
```

This generates the demo company (400 customers, 350 products, 5,000 orders over two years), creates the six demo accounts, and trains the demand forecast, the late-payment model and the recommendations. It takes about two minutes.

Open `https://demo.yourdomain.com`: the login page should show the demo accounts.

## 6. Your own admin account

The demo Admin is shared with visitors. For yourself, create a private admin whose password isn't published:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec \
  -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a-long-private-password-1' backend npm run create-admin
```

## 7. Reset every night

```bash
crontab -e
```

Add this line (03:00 UTC every day, logged to a file):

```
0 3 * * * /srv/b2b/deploy/demo-reset.sh >> /srv/b2b/demo-reset.log 2>&1
```

Visitors who are signed in during the reset are signed out, because the data they were looking at is replaced.

## Updating

```bash
cd /srv/b2b
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
./deploy/demo-reset.sh
```

## Checking on it

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail 50 backend
tail -20 /srv/b2b/demo-reset.log
curl -s https://demo.yourdomain.com/api/health
```

No backups are needed: everything is regenerated every night.
