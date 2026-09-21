# Hold'em Coach API worker

A small Cloudflare Worker that holds the shared Anthropic API key so friends can use
the AI coach at kevinkeet.com/poker without their own keys. The app asks for a
**table password** once; every AI request carries it, the worker checks it, and
forwards the request to Claude. The key never reaches a browser.

## Deploy (once)

Run these from a local clone of this repo (the `frontpage` repository), in order.
The worker must exist before secrets can be attached to it, so deploy first.

```bash
cd poker/worker
npm install
npx wrangler login                          # one-time; opens a browser to authorize
npm run deploy                              # first deploy creates the worker and prints its URL
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when prompted
npx wrangler secret put SITE_PASSWORD       # the password you give friends
```

Wrangler prints the worker URL, e.g. `https://holdem-coach-api.<you>.workers.dev`.
Secrets take effect immediately; no second deploy is needed.

If something goes wrong: `npx wrangler whoami` shows whether login worked,
`npx wrangler deployments list` shows whether the deploy happened, and
`npx wrangler secret list` shows which secrets are set. Re-running any of the
commands above is safe.

## Wire it into the app

In `poker/index.html`, near the top of the page:

```js
window.__COACH_SERVER = 'https://holdem-coach-api.<you>.workers.dev';
```

Commit and push. From then on the site opens with a password screen; after a
correct password the AI coach works for everyone with no key field needed.

## What the password does and does not protect

GitHub Pages is a static host, so the page itself cannot be locked server-side:
the password screen is a courtesy lock on the site, and a determined person could
read the HTML. What is genuinely protected is the API key and the spend: the
worker only forwards requests that carry the right password, limits each IP to
30 requests a minute, caps output at 2,000 tokens and restricts the model list.
To revoke access, change `SITE_PASSWORD` (`npx wrangler secret put SITE_PASSWORD`).

## Local dev

```bash
npm run dev     # http://localhost:8787 — set window.__COACH_SERVER to that
```
