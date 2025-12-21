# Sourceful EMS Dashboard

A real-time energy management dashboard for monitoring distributed energy resources (DERs) connected to the [Sourceful Energy](https://sourceful.energy) platform.

## Features

- **Wallet Authentication** - Secure login via Solana wallet using Privy
- **Real-time Monitoring** - Live data for PV inverters, batteries, grid meters, and site load
- **Interactive Charts** - Time series visualization with clickable legend to show/hide data series
- **Multi-DER Support** - View all distributed energy resources at a site including energy meters
- **Adaptive Resolution** - Charts automatically adjust data resolution based on time range

## Quick Start

### Prerequisites

- Node.js 18+
- A Solana wallet (Phantom, Solflare, etc.)
- Privy account for authentication ([dashboard.privy.io](https://dashboard.privy.io))

### Installation

```bash
# Clone the repository
git clone https://github.com/srcfl/ems-dashboard.git
cd ems-dashboard

# Install frontend dependencies
cd frontend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Privy App IDs
```

### Configuration

Create `frontend/.env` with your Privy credentials:

```env
VITE_PRIVY_APP_ID_PROD=your-production-app-id
VITE_PRIVY_APP_ID_DEV=your-development-app-id
```

### Running

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

```
ems-dashboard/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── api/       # Sourceful API client
│   │   ├── auth/      # Privy authentication
│   │   ├── components/# UI components
│   │   ├── contexts/  # React contexts
│   │   └── hooks/     # Custom hooks
│   └── ...
├── backend/           # Optional FastAPI backend (for InfluxDB)
└── docs/              # Documentation
```

## API Integration

The dashboard connects directly to the Sourceful GraphQL API (`api-vnext.srcful.dev`) using Ed25519 wallet signatures for authentication.

For detailed API documentation, see:
- [API Blueprint](docs/SOURCEFUL_API_BLUEPRINT.md) - Developer guide for building on Sourceful
- [API Documentation Gaps](docs/API_DOCUMENTATION_GAPS.md) - Known documentation issues

## Data Sources

The dashboard supports two data sources (configurable in settings):

1. **Sourceful API** (default) - Direct connection to Sourceful's GraphQL API
2. **InfluxDB** - Optional backend with InfluxDB for custom data storage

## DER Types Supported

| Type | Prefix | Description |
|------|--------|-------------|
| PV | `pv-` | Solar inverters |
| Battery | `bt-` | Battery storage systems |
| Meter | `em-` | Energy meters (grid connection) |
| Charger | `ch-` | EV chargers |

## Development

```bash
# Run development server
npm run dev

# Type check
npm run build

# Lint
npm run lint
```

## Security

See [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) for security review details.

Key security features:
- No hardcoded secrets
- Environment-based configuration
- Ed25519 wallet signatures for API auth
- Console logs stripped in production builds

## License

MIT

## Links

- [Sourceful Energy](https://sourceful.energy)
- [Sourceful Developer Docs](https://docs.srcful.io)
- [Privy Documentation](https://docs.privy.io)
