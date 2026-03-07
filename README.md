# Bill Split (MVP)

Collaborative restaurant bill splitting via a shareable live session.

## Core flow

- Home → **Start New Bill**
- Creates a unique bill session → redirects to `/bill/:id`
- Session page supports:
  - join with name
  - shareable URL + QR code
  - add/edit/delete items
  - assign items to one or more participants
  - live per-person totals (auto-refresh)
  - tip toggle + % selector + distribute to all or selected participants
  - receipt photo upload → AI extracts items → **user reviews/edit** → save

## Stack

- Next.js (App Router) + TypeScript
- TailwindCSS
- Postgres via `pg` (tables auto-created on first run)
- OpenAI API for receipt parsing

## Data model

- `bill_sessions`
- `participants`
- `bill_items`
- `item_assignments`
- `tip_config`
- `tip_config_participants`

## Setup

### 1) Environment variables

Create `.env.local`:

```bash
# Database
# On Vercel this is usually provided when you add a Postgres/Neon integration.
POSTGRES_URL="postgres://USER:PASSWORD@HOST:5432/DB?sslmode=require"

# Receipt parsing
OPENAI_API_KEY="..."
# Optional
OPENAI_RECEIPT_MODEL="gpt-4.1-mini"
```

### 2) Install + run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add a Postgres provider (Vercel marketplace / Neon).
4. Set env vars in Vercel:
   - `POSTGRES_URL` (or `DATABASE_URL`)
   - `OPENAI_API_KEY`
5. Deploy.

## How totals work

- **Item total** = `price * quantity`
- If an item is assigned to multiple participants, it splits **evenly** among them.
- **Tip** = `subtotal * percentage`
- Tip splits evenly across either:
  - everyone, or
  - selected participants

## Known limitations (MVP)

- No auth: anyone with the link can edit.
- Guest bills currently expire after **30 minutes** (to protect free DB usage).
- “Live” updates are implemented with client refresh (~2s) rather than realtime websockets.
- Currency is hardcoded to CLP formatting.
- No taxes automation; you can add tax as a manual line item.
- No concurrency control (last write wins).
- Receipt parsing quality depends on photo quality and the model.

## License

MIT
