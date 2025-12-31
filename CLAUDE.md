# EMS Dashboard - Development Notes

## Project Overview

Sourceful Energy EMS Dashboard - A full-stack energy management system for monitoring and managing distributed energy resources (DERs) including solar (PV), batteries, grid meters, and EV chargers. Includes a custom domain-specific language (SEL) for energy automation rules.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  - Dashboard UI with real-time monitoring                   │
│  - Customizable widget layout                               │
│  - SEL rule editor with syntax highlighting                 │
│  - Privy wallet authentication                              │
└────────────────┬──────────────────────┬─────────────────────┘
                 │                      │
                 ▼                      ▼
┌────────────────────────┐    ┌────────────────────────┐
│   Sourceful GraphQL    │    │      SEL Service       │
│   (External API)       │    │   (Rust/Axum)          │
│   api-vnext.srcful.dev │    │   - Compile rules      │
└────────────────────────┘    │   - Evaluate metrics   │
                              │   - Execute actions    │
                              │   - Dispatch webhooks  │
                              └───────────┬────────────┘
                                          │
                                          ▼
                              ┌────────────────────────┐
                              │      PostgreSQL        │
                              │   (Planned)            │
                              │   - Rules per site     │
                              │   - Webhook configs    │
                              │   - Execution logs     │
                              └────────────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Charts**: ECharts (via echarts-for-react)
- **Animation**: Framer Motion
- **Authentication**: Privy (email + Solana wallet)
- **API**: Sourceful GraphQL API
- **Deployment**: Vercel (auto-deploy from GitHub)

### Backend (SEL Service)
- **Language**: Rust
- **Web Framework**: Axum 0.8
- **Async Runtime**: Tokio
- **Serialization**: Serde
- **Optional**: WebAssembly compilation

## Project Structure

```
ems-dashboard/
├── frontend/                 # React app (Vercel deploys from here)
│   ├── src/
│   │   ├── api/             # API clients, types, demo data
│   │   ├── auth/            # Privy provider config
│   │   ├── components/      # React components (30+)
│   │   ├── contexts/        # React contexts (DataContext)
│   │   ├── hooks/           # Custom hooks
│   │   └── lib/             # Utilities
│   ├── public/              # Static assets (logos, favicon)
│   └── Dockerfile           # Multi-stage nginx container
│
├── packages/
│   └── sel-lang/            # SEL Language (Rust)
│       ├── src/
│       │   ├── ast.rs       # Abstract syntax tree
│       │   ├── lexer.rs     # Tokenization
│       │   ├── parser.rs    # Parser
│       │   ├── compiler.rs  # Compile to JSON
│       │   ├── runtime.rs   # Execution engine
│       │   ├── scheduler.rs # Schedule management
│       │   ├── dispatcher.rs# Action dispatcher
│       │   └── bin/server.rs# REST API server
│       ├── SPEC.md          # Language specification
│       └── Cargo.toml
│
├── docs/                    # Documentation
│   ├── SOURCEFUL_API_BLUEPRINT.md
│   ├── API_DOCUMENTATION_GAPS.md
│   └── SECURITY_AUDIT.md
│
├── docker-compose.yml       # Docker compose config
└── CLAUDE.md               # This file
```

## Key Features

### 1. Customizable Dashboard
- **Widget reordering**: Up/down arrows to change widget order
- **Widget visibility**: Toggle widgets on/off
- **Persistence**: Layout saved to localStorage
- **Edit mode**: Visual editing with amber highlights
- Component: `src/components/DashboardLayout.tsx`

### 2. Demo Mode
- Two demo sites with different profiles:
  - **Demo Home**: Residential (4.5kW solar, BYD battery)
  - **Demo Office**: Commercial (12kW solar, Tesla battery, high daytime load)
- Realistic data generation (solar curves, load patterns)
- No authentication required
- Data source: `src/api/demo-data.ts`

### 3. Real-Time Charts
- **Incremental updates**: Appends new data points (no full refetch)
- **Smooth animation**: 300ms transitions with cubic easing
- **Interactive**: Zoom, pan, tooltips
- **Auto-refresh**: 10-second interval
- Component: `src/components/PowerChart.tsx`

### 4. SEL (Sourceful Energy Language)
- Domain-specific language for energy automation
- Event-driven rules: `ON battery_soc < 20%`
- Scheduled rules: `EVERY day AT 18:00`
- Actions: `NOTIFY`, `WEBHOOK`, `COOLDOWN`
- Full compiler pipeline: Lexer → Parser → AST → JSON

### 5. Automation Panel
- Create/edit SEL rules via UI
- Real-time syntax validation
- Enable/disable rules
- Activity log
- Component: `src/components/AutomationPanel.tsx`

## Authentication Flow

1. **Privy Login**: User logs in with email or Solana wallet
   - Config in `src/auth/PrivyProvider.tsx`
   - Dev App ID: `cmdpnpacq01jtl40iof3ptm4u`
   - Prod App ID: `cmeh0sbu300bfju0b7gwxctnk`

2. **Sourceful API Auth**: After Privy login, user signs a message
   - One-time signature, cached in localStorage for 1 year
   - Headers: `x-auth-message`, `x-auth-signature`

3. **Demo Mode**: Click "Try Demo" - no auth needed
   - Credentials: `{ message: 'demo-mode' }`

## Environment Variables

```bash
# Frontend (.env)
VITE_PRIVY_APP_ID_PROD=cmeh0sbu300bfju0b7gwxctnk
VITE_PRIVY_APP_ID_DEV=cmdpnpacq01jtl40iof3ptm4u
VITE_EMS_API_KEY=<api-key>
VITE_SEL_API_URL=http://localhost:3030  # Optional, for SEL backend
```

## Development

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

### SEL Backend
```bash
cd packages/sel-lang
cargo build --release
cargo run --bin server
# Server at http://localhost:3030
```

### Docker
```bash
docker-compose up --build
```

## API Endpoints

### Sourceful GraphQL
- Base: `https://api-vnext.srcful.dev/`
- Auth: Ed25519 wallet signature

### SEL Server (local)
- `POST /api/validate` - Syntax validation
- `POST /api/compile` - Compile to JSON
- `POST /api/evaluate` - Evaluate metrics against rules
- `GET /api/health` - Health check

## Deployment

- **Production**: https://dashboard.sourceful.dev
- **Platform**: Vercel (auto-deploy on push to `main`)
- **Build**: `npm run build` in `frontend/`

## Recent Changes (2024-12-31)

### Customizable Dashboard
- Added `DashboardLayout` component with widget management
- Edit mode with reorder controls (up/down arrows)
- Widget visibility toggles
- Layout persistence to localStorage
- Smooth framer-motion animations

### Multi-Site Demo Mode
- Added second demo site ("Demo Office")
- Different data profiles (residential vs commercial)
- Site selector tabs in demo mode
- Site-specific data generation

### Chart Improvements
- Switched from full refetch to incremental updates
- Added `refreshTrigger` prop for controlled updates
- Smooth ECharts animations (300ms cubic easing)
- Trimming old data to maintain time window

### SEL Language (Complete)
- Full lexer/parser implementation
- Compiler to JSON format
- Runtime engine for evaluation
- Scheduler for timed rules
- Notification dispatcher
- REST API server (Axum)

## Roadmap

### Phase 1: Core Features (Completed)
- [x] Dashboard with real-time monitoring
- [x] Privy authentication
- [x] Demo mode
- [x] Customizable widget layout
- [x] SEL language compiler
- [x] Automation panel

### Phase 2: Backend Integration (In Progress)
- [ ] Webhook configuration UI per site
- [ ] PostgreSQL schema for persistence
- [ ] SEL server database integration
- [ ] Docker Compose full stack

### Phase 3: Advanced Features (Planned)
- [ ] Telegram bot integration
- [ ] Email notifications
- [ ] Rule templates library
- [ ] Multi-user support
- [ ] Historical analytics

## Known Issues

- **Privy email validation**: Brief button disable when typing `.com` (Privy bug)
- **Safari**: Some older versions have chart rendering issues
- **Demo data**: Generates random values, not historically consistent

## Git Workflow

- Main branch: `main`
- Auto-deploy to Vercel on push
- Commit messages include Claude Code attribution
