# Frontend

React 19 + Vite + Tailwind CSS. The staff back office and the client portal are one app (`src/pages` and `src/portal`).

```bash
npm install
cp .env.example .env.local   # VITE_API_URL, the API address
npm run dev                  # http://localhost:5173
npm run lint
npm run i18n:check           # every text has a French and Arabic translation
npm run build
```

Translations live in `src/i18n` (English text is the key; see `scripts/i18n-check.mjs`). Shared UI pieces are in `src/components/ui`.

See the [main README](../README.md) for the whole project.
