# Sourceful EMS Dashboard

An open-source, real-time energy management dashboard for monitoring distributed energy resources (DERs) connected to the [Sourceful Energy](https://sourceful.energy) platform.

**Built for the Sourceful Energy community** - This project is open source and welcomes contributions from developers, energy professionals, and anyone interested in advancing distributed energy resource management.

## Features

- **Wallet Authentication** - Secure login via Solana wallet using Privy
- **Real-time Monitoring** - Live data for PV inverters, batteries, grid meters, and site load
- **Interactive Charts** - Time series visualization with clickable legend to show/hide data series
- **Multi-DER Support** - View all distributed energy resources at a site including energy meters
- **Adaptive Resolution** - Charts automatically adjust data resolution based on time range
- **EMS Visualizations** - Comprehensive Energy Management System (EMS) visualizations including:
  - **EMS Status Dashboard** - Real-time optimizer status, current mode, managed DERs, and electricity pricing
  - **EMS Schedule Chart** - Visual schedule showing optimization modes (IDLE, SELF_CONSUMPTION, FORCE_CHARGE, FORCE_DISCHARGE) over time with battery/EV state-of-charge, power forecasts, and pricing data

## Quick Start

### Prerequisites

- Node.js 18+
- A Solana wallet (Phantom, Solflare, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/srcfl/ems-dashboard.git
cd ems-dashboard

# Install frontend dependencies
cd frontend
npm install
```

**Note:** The Privy app IDs for Sourceful Energy are configured by default, so the project works out of the box. No environment configuration needed!

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

## Contributing

We welcome contributions from the Sourceful Energy community! Whether you're fixing bugs, adding features, improving documentation, or suggesting enhancements, your help makes this project better for everyone.

### How to Contribute

1. **Fork the repository** and create a new branch for your changes
2. **Make your changes** - Follow the existing code style and add tests if applicable
3. **Test your changes** - Ensure everything works and passes linting
4. **Submit a pull request** - Include a clear description of your changes and why they're valuable

### Areas We'd Love Help With

- 🐛 Bug fixes and improvements
- ✨ New features and DER type support
- 📊 Enhanced visualizations and charts
- 📝 Documentation improvements
- 🎨 UI/UX enhancements
- ⚡ Performance optimizations
- 🧪 Test coverage

### Questions or Ideas?

Feel free to open an issue to discuss ideas, report bugs, or ask questions. We're here to help!

## Security

See [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) for security review details.

Key security features:
- No hardcoded secrets
- Environment-based configuration
- Ed25519 wallet signatures for API auth
- Console logs stripped in production builds

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

Built with ❤️ for the Sourceful Energy community. Special thanks to all contributors who help make this project better.

## Links

- [Sourceful Energy](https://sourceful.energy)
- [Sourceful Developer Docs](https://docs.srcful.io)
- [Privy Documentation](https://docs.privy.io)
