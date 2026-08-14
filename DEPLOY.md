# Term Roulette

Minimal fullscreen term roulette for screen recording. Press **SPACE** to spin.

## GitHub Pages (frontend)

1. Push this repo to GitHub.
2. Go to **Settings → Pages** and deploy from the `main` branch (root).
3. Your site will be at `https://DenysLentsov.github.io/TermRoulette/` (or a custom domain).

Update [`site-config.js`](site-config.js) with your Cloudflare Worker URL before deploying.

## Cloudflare Worker (Gemini proxy)

The API key lives only in Cloudflare — never in the browser or GitHub repo.

### One-time setup

1. Install [Node.js](https://nodejs.org/) and create a [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. Log in with Wrangler:

```bash
cd worker
npm install
npx wrangler login
```

3. Store your Gemini API key as a Worker secret:

```bash
npx wrangler secret put GEMINI_API_KEY
# paste your key when prompted
```

4. Allow your GitHub Pages origin in [`worker/wrangler.toml`](worker/wrangler.toml):

```toml
ALLOWED_ORIGINS = "https://DenysLentsov.github.io,http://localhost:8765,http://127.0.0.1:8765"
```

If the repo is `TermRoulette`, the origin is usually `https://denyslentsov.github.io/TermRoulette/` — match the exact `Origin` header your browser sends.

5. Deploy the worker:

```bash
npm run deploy
```

Wrangler prints your worker URL, e.g. `https://term-roulette-api.denyslentsov.workers.dev`.

6. Set that URL in [`site-config.js`](../site-config.js):

```javascript
const SITE_CONFIG = {
  apiProxyUrl: "https://term-roulette-api.denyslentsov.workers.dev",
};
```

Commit and push — GitHub Pages will serve the site; explanations go through Cloudflare.

### Local development

Terminal 1 — run the worker:

```bash
cd worker
cp .dev.vars.example .dev.vars   # add your GEMINI_API_KEY
npm run dev                        # http://localhost:8787
```

Terminal 2 — serve the site:

```bash
python3 -m http.server 8766
```

For local testing, point `site-config.js` at the dev worker:

```javascript
apiProxyUrl: "http://localhost:8787",
```

Open `http://localhost:8766`.

## Security notes

- `config.js` (old API-key file) is gitignored — do not commit API keys.
- Rotate your Gemini key if it was ever committed or shared in chat.
- Restrict `ALLOWED_ORIGINS` to your GitHub Pages domain in production.
