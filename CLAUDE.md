# EMS Dashboard - Development Notes

## Project Overview

Sourceful Energy EMS Dashboard - A React-based energy management dashboard for monitoring and controlling distributed energy resources (DERs) including solar (PV), batteries, grid meters, and EV chargers. Includes a full EMS (Energy Management System) panel with optimizer schedule visualization and battery controls.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **UI Components**: `@sourceful-energy/ui` (Sourceful Design System)
- **Styling**: Tailwind CSS
- **Charts**: ECharts (echarts-for-react), Recharts
- **Animation**: Framer Motion
- **Authentication**: Privy (email + Solana wallet)
- **APIs**: Sourceful GraphQL API, EMS Manager API
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
- **PowerChart.tsx** - Time series power chart with recharts
- **EMSPanel.tsx** - EMS optimization panel (status + controls + schedule)
- **EMSStatusCard.tsx** - Live optimizer/controller status display
- **EMSControlPanel.tsx** - Battery charge-now, DER SoC limits
- **EMSScheduleChart.tsx** - 24h schedule visualization with prices + SoC
- **DataContext.tsx** - Global data, auth state, and credential management

## Authentication Flow

1. **Privy Login**: User logs in with email or Solana wallet
2. **Auto Credential Generation**: After Privy login, wallet signing is auto-triggered
   - One-time signature, cached in localStorage for 1 year
   - Logic in `src/hooks/useSourcefulAuth.ts`
   - Same credentials used for both Sourceful GraphQL API and EMS Manager API

## EMS Manager API

The dashboard uses the **Manager API** (`/ems/manager/api/v1`) exclusively. It acts as a gateway to both the Optimizer and Controller APIs, and supports wallet auth.

- **Auth headers**: `x-auth-message` + `x-auth-signature` (Base58-encoded)
- **Base URL**: Proxied via vite config to `https://mainnet.srcful.dev`
- **Client**: `src/api/ems-manager-client.ts`
- **Types**: `src/api/ems-manager-types.ts`

Key endpoints:
- `GET /sites` - List sites for wallet
- `GET /sites/{id}` - Site detail (DERs, config)
- `GET /sites/{id}/status` - Combined optimizer + controller status
- `GET /sites/{id}/schedule?verbose=true` - 24h optimization schedule
- `POST /sites/{id}/ders/{id}/charge-now` - Enable force charge
- `DELETE /sites/{id}/ders/{id}/charge-now` - Stop force charge
- `PATCH /sites/{id}/ders/{id}` - Update DER config (SoC limits)

### API Gotchas
- Schedule slots use `sig` sub-object: `sig.pr` (import price), `sig.epr` (export price), `sig.ld` (load), `sig.prod` (production)
- DER `soc` field is 0-1 fraction, multiply by 100 for display percentage
- DER type can be `'bt'` (controller) or `'battery'` (optimizer) - handle both
- Optimizer runs 2 replicas with lease-based site management

## Environment Variables

```env
VITE_PRIVY_APP_ID_PROD=cmeh0sbu300bfju0b7gwxctnk
```

## Demo Mode vs Real Mode

- **Demo Mode**: Shows demo sites with simulated data
- **Real Mode**: Connects to Sourceful API and EMS Manager API with wallet auth

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
- **EMS Manager API**: `mainnet.srcful.dev/ems/manager/api/v1` (proxied via vite config)

## Sourceful Design System

This project uses the **Sourceful Design System** (`@sourceful-energy/ui`).

Reference: https://design.sourceful.energy/

### Component Usage

```tsx
// Styles imported in main.tsx
import "@sourceful-energy/ui/styles.css"

// Import components as needed
import { Button, Card, Badge, Input, Label } from "@sourceful-energy/ui"
```

### Component Quick Reference

| Need | Use |
|------|-----|
| Actions | `Button` (variants: default, outline, destructive, energy, success, warning) |
| Status indicators | `Badge` (variants: default, secondary, destructive, outline, energy, success, warning, info) |
| Containers | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| Forms | `Input`, `Label`, `Select`, `Checkbox`, `Switch`, `Textarea`, `Slider` |
| Feedback | `Alert`, `toast` (from sonner), `Progress`, `Skeleton` |
| Overlays | `Dialog`, `Sheet`, `DropdownMenu`, `Tooltip` |
| Layout | `Tabs`, `Accordion`, `Separator`, `ScrollArea`, `Table` |
| Brand | `Logo` (variants: full, symbol, wordmark) |

### Color Tokens

Use semantic tokens instead of raw hex values:
- `text-primary` - Sourceful green
- `text-destructive` - Error red
- `bg-muted` - Subtle background
- `text-muted-foreground` - Secondary text

### Energy Flow Colors (custom)
CSS variables defined in `src/index.css`:
- `--solar`: #FFD500 (Yellow)
- `--battery`: #00FF84 (Neon green)
- `--grid`: #42A5F5 (Blue)
- `--load`: #94a3b8 (Muted gray)
- `--ev`: #14B8A6 (Teal)

### Don't
- Don't create custom buttons, cards, or form inputs - use the design system
- Don't use raw colors like `#22c55e` - use tokens like `text-primary`
- Don't install shadcn/ui directly - components are already included
- Don't create custom modal/dialog components - use `Dialog` or `Sheet`
