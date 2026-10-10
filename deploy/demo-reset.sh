#!/bin/sh
# Nightly reset for the public demo: fresh demo data and accounts, then the
# three models retrained on it. Run from cron on the server, e.g.
#   0 3 * * * /srv/b2b/deploy/demo-reset.sh >> /var/log/b2b-demo-reset.log 2>&1
# The backend refuses to reset unless DEMO_MODE=true.
set -eu

cd "$(dirname "$0")/.."
# Override to use other compose files, e.g. COMPOSE="docker compose" without HTTPS.
compose="${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"

echo "$(date -u '+%F %T') demo reset starting"
$compose exec -T backend npm run --silent demo:reset
for job in forecast risk recommend; do
    $compose --profile ml run --rm ml "$job"
done
echo "$(date -u '+%F %T') demo reset done"
