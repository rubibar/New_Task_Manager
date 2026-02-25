# Replica Task Manager

Priority-driven task management for Replica Studio. Automated scoring ranks tasks by urgency, type, and deadlines using Israel business hours (Sun-Thu 10:00-18:00). Built for a 3-person creative/animation team.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (Neon) with Prisma ORM
- **Auth:** NextAuth.js v4 + Google OAuth
- **Calendar:** Google Calendar API (bidirectional sync)
- **Animations:** Framer Motion
- **Data Fetching:** SWR
- **Package Manager:** pnpm
- **Deployment:** Vercel

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd replica-task-manager
pnpm install
```

### 2. Google Cloud Console

1. Create a project in Google Cloud Console
2. Enable **Google Calendar API**
3. Create OAuth 2.0 credentials (Web application)
4. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
5. Copy Client ID and Client Secret

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev) |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `GOOGLE_CALENDAR_ID` | Shared Google Calendar ID |
| `POSTGRES_URL` | PostgreSQL connection URL (pooled) |
| `POSTGRES_PRISMA_URL` | PostgreSQL URL for Prisma (pooled) |
| `POSTGRES_URL_NON_POOLING` | PostgreSQL direct URL (non-pooled) |
| `CRON_SECRET` | Secret for protecting cron endpoints |

### 4. Database

```bash
pnpm db:push      # Push schema to database
pnpm db:seed      # Seed with sample data
pnpm db:studio    # Open Prisma Studio (optional)
```

### 5. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scoring System

Tasks are ranked 0-100 using:

```
RawScore = (BaseWeight + UserPriority + Aging) x UrgencyMultiplier + Boosts
DisplayScore = (RawScore / MaxRawScore) x 100
```

- **Base Weight:** Client (30), R&D (15), Admin (5)
- **User Priority:** Urgent+Important (40), Important (25), Urgent (15), Low (5)
- **Urgency Multiplier:** 1.0x (>40h) to 3.0x (overdue) based on remaining working hours
- **Aging:** +2 per 24 working hours in TODO status
- **Boosts:** In Review (+50), Emergency (+100), Sunday R&D Time (+100)

Scores recalculate every 5 minutes. Thursday 14:00 IST triggers planning freeze.

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add all environment variables
4. Deploy - cron jobs auto-configure from `vercel.json`

## Screenshots

_Coming soon_
