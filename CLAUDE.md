# EMS Dashboard - Development Notes

## Project Overview

Sourceful Energy EMS Dashboard - A React-based energy management dashboard for monitoring distributed energy resources (DERs) including solar (PV), batteries, grid meters, and EV chargers.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Authentication**: Privy (email + Solana wallet)
- **API**: Sourceful GraphQL API
- **Deployment**: Railway

## Project Structure

```
ems-dashboard/
├── src/
│   ├── api/             # API clients, types, demo data
│   ├── auth/            # Privy provider config
│   ├── components/      # React components
│   │   └── ui/          # shadcn/ui components
│   ├── contexts/        # React contexts (DataContext)
│   ├── hooks/           # Custom hooks
│   └── lib/             # Utilities
├── public/              # Static assets (logos, favicon)
├── index.html           # Entry point
├── package.json
├── vite.config.ts
└── nixpacks.toml        # Railway build config
```

## Key Components

- **SiteDashboard.tsx** - Main dashboard with widget layout
- **PowerChart.tsx** - Time series chart with recharts
- **AutomationPanel.tsx** - SEL rule editor and management
- **EMSPanel.tsx** - EMS optimization panel
- **DataContext.tsx** - Global data and auth state

## Authentication Flow

1. **Privy Login**: User logs in with email or Solana wallet
2. **Sourceful API Auth**: After Privy login, user signs a message for API access
   - One-time signature, cached in localStorage for 1 year
   - Logic in `src/hooks/useSourcefulAuth.ts`

## Environment Variables

```env
VITE_PRIVY_APP_ID_PROD=cmeh0sbu300bfju0b7gwxctnk
VITE_SEL_API_URL=https://sel-backend.railway.app  # Optional
```

## Demo Mode vs Real Mode

- **Demo Mode**: Shows demo sites with simulated data, demo automation rules
- **Real Mode**: Connects to Sourceful API, saves rules per-site to localStorage

## Development

```bash
npm install
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run lint     # ESLint
```

## Deployment

```bash
railway up       # Deploy to Railway
```

## External Dependencies

- **Sourceful GraphQL API**: `api-vnext.srcful.dev`
- **SEL Backend** (separate repo): For automation rule execution
