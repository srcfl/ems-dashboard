# EMS Dashboard - Claude Development Notes

## Project Overview

Sourceful Energy EMS Dashboard - A React frontend for monitoring and managing energy sites with solar (PV), battery, grid, and EV charger data.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Authentication**: Privy (email + Solana wallet)
- **API**: Sourceful GraphQL API (`api-vnext.srcful.dev`)
- **Deployment**: Vercel (auto-deploy from GitHub)

## Project Structure

```
ems-dashboard/
├── frontend/           # React app (Vercel deploys from here)
│   ├── src/
│   │   ├── api/        # API clients and types
│   │   ├── auth/       # Privy provider config
│   │   ├── components/ # React components
│   │   ├── contexts/   # React contexts (DataContext)
│   │   └── hooks/      # Custom hooks (useSourcefulAuth)
│   ├── public/         # Static assets (logos, favicon)
│   └── vercel.json     # Vercel rewrites config
├── vercel.json         # Root Vercel config (points to frontend/)
└── README.md
```

## Authentication Flow

1. **Privy Login**: User logs in with email or Solana wallet
   - Privy handles session persistence automatically
   - Config in `src/auth/PrivyProvider.tsx`

2. **Sourceful API Auth**: After Privy login, user signs a message for API access
   - One-time signature, cached in localStorage for 1 year
   - Credentials include: base58-encoded message + signature
   - Logic in `src/hooks/useSourcefulAuth.ts`

## Key Files

- `src/App.tsx` - Main app with login/dashboard views
- `src/components/SiteDashboard.tsx` - Main dashboard with charts and cards
- `src/components/PowerChart.tsx` - Time series chart (recharts)
- `src/components/EMSPanel.tsx` - EMS optimization panel
- `src/components/OpenSourceBanner.tsx` - Community banner with GitHub link
- `src/api/sourceful-client.ts` - GraphQL API client

## Environment Variables (Vercel)

```
VITE_PRIVY_APP_ID_PROD=cmeh0sbu300bfju0b7gwxctnk
VITE_PRIVY_APP_ID_DEV=cmdpnpacq01jtl40iof3ptm4u
VITE_EMS_API_KEY=<api-key>
```

## Deployment

- **Production**: https://dashboard.sourceful.dev (custom domain)
- **Vercel Project**: `frontend` under `sourceful-labs`
- Auto-deploys on push to `main` branch

### Manual Deploy
```bash
cd frontend
vercel --prod
```

## Recent Changes (2024-12-30)

### Vercel Deployment
- Added `vercel.json` configs for GitHub integration
- Root config specifies `frontend/` as build directory
- Rewrites `/ems/*` to `mainnet.srcful.dev`

### Branding
- Added Sourceful favicon (`favicon.png`)
- Added wide logo for header (`sourceful-logo.png`)
- Added roundel logo for login page (`sourceful-roundel.png`)
- Updated page title to "EMS Dashboard - Sourceful Energy"

### Open Source Banner
- Added dismissible banner on all pages
- Links to GitHub repo for issues/PRs
- Component: `src/components/OpenSourceBanner.tsx`

### Bug Fixes
- **Safari compatibility**: Fixed date formatting in charts (no toLocaleString)
- **ErrorBoundary**: Added error boundaries around charts
- **Null safety**: Fixed crashes in EMS components when data is undefined
- **StrictMode removed**: Prevents double-render issues with Privy

### Auth UX Improvements
- Improved "Sign & Connect" button with clearer messaging
- Simplified wallet signing (removed uiOptions for smoother flow)
- Credentials cached for 1 year after first sign

## Known Issues

- **Privy email validation**: Typing `.com` sometimes disables submit button briefly (Privy bug, not fixable on our end)
- **Safari**: Some older Safari versions may have rendering issues with charts

## Development

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

## Git Workflow

- Main branch: `main`
- Auto-deploy to Vercel on push
- Commit messages include Claude Code attribution
