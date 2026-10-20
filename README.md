# jeopardy-in-a-flash

A frontend that shows one Jeopardy! clue at a time. Press the right arrow or `L`, or click the card, to reveal the response and then load the next clue.

The working site is https://jeopardy-in-a-flash.descriptive-perch.workers.dev. GitHub Pages keeps working too, and calls that same host.

The site used to call [jService](https://github.com/sottenad/jService) at `https://jservice.io`. That host is offline. Standing the original Rails app back up means Ruby, Postgres, and a multi-hour scrape of J-Archive, which is more than this page needs: it only calls `GET /api/random` and `GET /api/clues?category=`.

This repo hosts a drop-in replacement on Cloudflare Workers:

- A Worker serves the same JSON routes (`/api/random`, `/api/clues`, `/api/final`, `/api/categories`, `/api/category`, and `POST /api/invalid`).
- [D1](https://developers.cloudflare.com/d1/) stores the clues, so a random clue and a category lookup are SQL queries instead of a Rails process.
- The Worker also serves this static page, and GitHub Pages can keep serving the page while calling the Worker.

Clues come from the public 216,930-question dump (show, round, category, value, clue, response, airdate). Each API category is one board column — a show, a round, and a title — so a request returns that column's clues, and the page shows the first five.

## Local development

```sh
npm install
node scripts/build-sql.mjs /path/to/JEOPARDY_QUESTIONS1.json /tmp/jeopardy-data/sql
npm run db:local
npm run dev
```

Open `http://localhost:8787`.

## Deploy

```sh
npx wrangler d1 create jservice   # once; put the id in wrangler.jsonc
npm run db:remote
npm run deploy
```

The GitHub Pages build calls the deployed Worker. Pages on any other host do too, as long as `HOSTED_API_ORIGIN` in `index.js` matches the Worker URL.

`wrangler.jsonc` points at the preview D1 database that is serving the site. Claim that preview into your Cloudflare account so the Worker and database stay up. After that, `npx wrangler login` and `npm run deploy` publish later changes against the same database. If the `workers.dev` subdomain changes when you claim the preview, update `HOSTED_API_ORIGIN` in `index.js`.
