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

## Sourceful Design System

This project implements the [Sourceful Design System](https://design.sourceful.energy/).

### Typography
- **Primary font**: Satoshi (loaded from Fontshare)
- **Monospace font**: JetBrains Mono (loaded from Google Fonts)

### Brand Colors
CSS variables are defined in `src/index.css`:
- `--energy-green`: #00FF84 (Neon green - primary brand color)
- `--energy-yellow`: #FFD500 (Energy accent)
- `--energy-orange`: #FF8533 (Warning states)
- `--energy-red`: #FF3D3D (Error states)
- `--energy-teal`: #14B8A6 (Secondary accent)
- `--energy-navy`: #1E3A5F (Depth)
- `--energy-blue`: #42A5F5 (Informational)

### Energy Flow Colors
- `--solar`: #FFD500 (Yellow)
- `--battery`: #00FF84 (Neon green)
- `--grid`: #42A5F5 (Blue)
- `--load`: #94a3b8 (Muted gray)
- `--ev`: #14B8A6 (Teal)

### Utility Classes
Energy color utilities available: `.text-solar`, `.bg-solar`, `.border-solar`, etc.

## Recent Changes (2025-01-01)

### UI Improvements
- **DataQualityStats**: Now shows real API connection status and latency (was simulated)
- **Battery icon**: Changed from signal bars to proper battery shape with fill level
- **Edit button**: Moved from top-right (overlapping cards) to fixed bottom-right corner

### Authentication Fixes
- **Wallet signing timeout**: Added 30-second timeout to prevent infinite loading
- **Auto-sync disabled on load**: AutomationPanel no longer triggers wallet signing on page load
  - Only syncs rules to backend when user makes actual changes
  - Fixes "Connecting to your wallet" dialog appearing unexpectedly

### Two Auth Systems
1. **Sourceful API Auth** (`useSourcefulAuth.ts`)
   - Signs once after Privy login, cached 1 year
   - Manual "Connect & Sign" button flow

2. **SEL Backend Auth** (`useSELAuth.ts`)
   - Session-based, 1 hour validity
   - On-demand only - triggered when saving automations
