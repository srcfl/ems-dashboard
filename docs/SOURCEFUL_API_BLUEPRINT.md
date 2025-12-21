# Building Applications with Sourceful Energy API

A comprehensive guide to building energy management applications using the Sourceful Energy GraphQL API.

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Authentication](#authentication)
4. [API Basics](#api-basics)
5. [Data Models](#data-models)
6. [Querying Data](#querying-data)
7. [Time Series Data](#time-series-data)
8. [Complete Code Examples](#complete-code-examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

Sourceful Energy provides a GraphQL API that enables developers to build energy management applications. This guide covers everything you need to know to integrate with the Sourceful platform, from authentication to querying real-time energy data from solar panels, batteries, and grid meters.

### What You Can Build

- Energy monitoring dashboards
- Solar production analytics
- Battery management systems
- Grid import/export tracking
- Load consumption analysis
- Historical energy reporting

### Prerequisites

- Basic understanding of GraphQL
- Familiarity with TypeScript/JavaScript
- Understanding of Solana wallets and Ed25519 signatures
- A Sourceful Energy account with registered devices

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Your App      │────▶│  Sourceful API   │────▶│  Energy Data    │
│   (Frontend)    │     │  (GraphQL)       │     │  (DERs/Sites)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │
        │ Ed25519 Signature
        ▼
┌─────────────────┐
│  Solana Wallet  │
│  (Privy/Phantom)│
└─────────────────┘
```

### Key Components

1. **Solana Wallet** - User identity and authentication
2. **GraphQL API** - Single endpoint for all data operations
3. **Sites** - Physical locations with energy equipment
4. **Devices** - Hardware units (inverters, gateways)
5. **DERs** - Distributed Energy Resources (PV, Battery, Meter)

---

## Authentication

Sourceful uses wallet-based authentication with Ed25519 signatures. This provides secure, decentralized identity verification.

### Authentication Flow

```
1. User connects Solana wallet (Phantom, Solflare, etc.)
2. App generates a structured message with timestamp and expiration
3. User signs the message with their wallet's private key
4. App encodes message and signature in Base58 format
5. Both are sent as HTTP headers with every API request
```

### Message Format

The authentication message must follow this exact format:

```
Sourceful Energy EMS Dashboard wants you to sign data with your Solana account:
{WALLET_ADDRESS}

Grant basic application access

Issued At (UTC): {ISO_TIMESTAMP}
Expiration Time (UTC): {ISO_TIMESTAMP}
```

### Implementation

```typescript
import bs58 from 'bs58';

// Generate the authentication message
function generateAuthMessage(
  walletAddress: string,
  issuedAt: Date,
  expirationTime: Date
): string {
  return `Sourceful Energy EMS Dashboard wants you to sign data with your Solana account:
${walletAddress}

Grant basic application access

Issued At (UTC): ${issuedAt.toISOString()}
Expiration Time (UTC): ${expirationTime.toISOString()}`;
}

// Encode message to Base58
function base58Encode(message: string): string {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(message);
  return bs58.encode(buffer);
}

// Encode signature to Base58
function base58EncodeSignature(signature: Uint8Array): string {
  return bs58.encode(signature);
}

// Complete authentication flow
async function authenticate(wallet: SolanaWallet): Promise<AuthCredentials> {
  const issuedAt = new Date();
  const expirationTime = new Date();
  expirationTime.setFullYear(expirationTime.getFullYear() + 1); // 1 year validity

  const message = generateAuthMessage(
    wallet.address,
    issuedAt,
    expirationTime
  );

  // Sign with wallet (using Privy, Phantom, etc.)
  const messageBytes = new TextEncoder().encode(message);
  const signature = await wallet.signMessage(messageBytes);

  return {
    message: base58Encode(message),
    signature: base58EncodeSignature(signature),
    walletAddress: wallet.address,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expirationTime.toISOString(),
  };
}
```

### Using Privy for Wallet Integration

[Privy](https://privy.io) provides an excellent wallet integration experience:

```typescript
import { PrivyProvider, usePrivy, useSolanaWallets } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// Configure Privy
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

function App() {
  return (
    <PrivyProvider
      appId="your-privy-app-id"
      config={{
        loginMethods: ['wallet'],
        appearance: { theme: 'dark' },
        externalWallets: { solana: { connectors: solanaConnectors } },
        solanaClusters: [{ name: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com' }],
      }}
    >
      <YourApp />
    </PrivyProvider>
  );
}

// Hook for signing
function useSourcefulAuth() {
  const { wallets } = useSolanaWallets();
  const { signMessage } = useSignMessage();

  const generateCredentials = async () => {
    const wallet = wallets[0];
    if (!wallet) throw new Error('No wallet connected');

    const message = generateAuthMessage(wallet.address, new Date(), expirationDate);
    const messageBytes = new TextEncoder().encode(message);

    const result = await signMessage({ message: messageBytes, wallet });
    // ... encode and return credentials
  };

  return { generateCredentials };
}
```

### Credential Caching

Cache credentials in localStorage to avoid repeated signing:

```typescript
const CREDENTIALS_KEY = 'sourceful_auth_credentials';

function getCachedCredentials(): AuthCredentials | null {
  try {
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (!stored) return null;

    const credentials = JSON.parse(stored);
    const expiresAt = new Date(credentials.expiresAt);

    // Check with 5 minute buffer
    if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
      return credentials;
    }

    localStorage.removeItem(CREDENTIALS_KEY);
    return null;
  } catch {
    return null;
  }
}

function cacheCredentials(credentials: AuthCredentials): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}
```

---

## API Basics

### Endpoint

```
https://api-vnext.srcful.dev/
```

### Request Format

All requests are POST requests with:
- `Content-Type: application/json`
- `x-auth-message: {base58_encoded_message}`
- `x-auth-signature: {base58_encoded_signature}`

### GraphQL Client

```typescript
const API_BASE = 'https://api-vnext.srcful.dev/';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphqlQuery<T>(
  query: string,
  credentials: AuthCredentials
): Promise<T> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-message': credentials.message,
      'x-auth-signature': credentials.signature,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }

  if (!result.data) {
    throw new Error('No data returned');
  }

  return result.data;
}
```

> **Important**: The Sourceful API does NOT support GraphQL variables. You must inline all values directly in the query string.

```typescript
// ❌ WRONG - Variables don't work
const query = `
  query GetSite($siteId: String!) {
    data { load(siteId: $siteId) { ... } }
  }
`;

// ✅ CORRECT - Inline values
const query = `{
  data {
    load(siteId: "${siteId}") {
      latest { timestamp W }
    }
  }
}`;
```

---

## Data Models

### Site Hierarchy

```
Site
├── id (UUID)
└── Devices[]
    ├── rawSn (Device Serial Number - e.g., "25119985")
    └── DERs[]
        ├── derSn (DER ID - e.g., "pv-abc123...", "bt-xyz789...")
        └── settings[]
            ├── key: "TYPE" → "Solar" | "Battery" | "EnergyMeter"
            └── key: "DEFAULT_ENERGY_METER" → "true" (for primary meter)
```

### DER Types

| Prefix | Type | Description |
|--------|------|-------------|
| `pv-` | Solar/PV | Photovoltaic inverter |
| `bt-` | Battery | Battery storage system |
| `em-` | Meter | Energy meter (grid connection) |
| `ch-` | Charger | EV charger |

### TypeScript Interfaces

```typescript
interface Site {
  id: string;
  devices: Device[];
}

interface Device {
  rawSn: string;  // Actual device serial number
  ders: DER[];
  settings?: Setting[];
}

interface DER {
  derSn: string;  // DER identifier (pv-xxx, bt-xxx, em-xxx)
  gwId: string;
  settings?: Setting[];
}

interface Setting {
  key: string;
  value: string;
}

// Response types for real-time data
interface PVData {
  timestamp: string;
  W: number | null;           // Power in Watts
  mppt1_V: number | null;     // MPPT 1 Voltage
  mppt1_A: number | null;     // MPPT 1 Current
  mppt2_V: number | null;     // MPPT 2 Voltage
  mppt2_A: number | null;     // MPPT 2 Current
  heatsink_C: number | null;  // Temperature
  total_generation_Wh: number | null;
}

interface BatteryData {
  timestamp: string;
  W: number | null;              // Power (+ charging, - discharging)
  A: number | null;              // Current
  V: number | null;              // Voltage
  SoC_nom_fract: number | null;  // State of Charge (0-1)
  heatsink_C: number | null;     // Temperature
  total_charge_Wh: number | null;
  total_discharge_Wh: number | null;
}

interface MeterData {
  timestamp: string;
  W: number | null;              // Total power (+ import, - export)
  Hz: number | null;             // Grid frequency
  L1_V: number | null;           // Phase 1 Voltage
  L1_A: number | null;           // Phase 1 Current
  L1_W: number | null;           // Phase 1 Power
  L2_V: number | null;           // Phase 2 Voltage
  L2_A: number | null;           // Phase 2 Current
  L2_W: number | null;           // Phase 2 Power
  L3_V: number | null;           // Phase 3 Voltage
  L3_A: number | null;           // Phase 3 Current
  L3_W: number | null;           // Phase 3 Power
  total_import_Wh: number | null;
  total_export_Wh: number | null;
}

interface LoadData {
  timestamp: string;
  W: number | null;  // Calculated load consumption
}
```

---

## Querying Data

### Get User's Sites

```typescript
async function getSites(credentials: AuthCredentials): Promise<string[]> {
  const query = `{
    sites {
      list {
        id
      }
    }
  }`;

  const data = await graphqlQuery<{ sites: { list: { id: string }[] } }>(
    query,
    credentials
  );

  return data.sites.list.map(site => site.id);
}
```

### Get Site Structure with All DERs

```typescript
async function getSiteStructure(credentials: AuthCredentials): Promise<Site[]> {
  const query = `{
    sites {
      list {
        id
        devices {
          rawSn
          ders {
            derSn
            gwId
            settings {
              key
              value
            }
          }
        }
      }
    }
  }`;

  const data = await graphqlQuery<{ sites: { list: Site[] } }>(query, credentials);
  return data.sites.list;
}
```

### Get Real-Time Load Data

```typescript
async function getLoadData(siteId: string, credentials: AuthCredentials) {
  const query = `{
    data {
      load(siteId: "${siteId}") {
        latest {
          timestamp
          W
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { load: { latest: LoadData | null } }
  }>(query, credentials);

  return data.data.load?.latest;
}
```

### Get PV Inverter Data

```typescript
async function getPVData(derSn: string, credentials: AuthCredentials) {
  const query = `{
    data {
      pv(sn: "${derSn}") {
        latest {
          timestamp
          W
          mppt1_V
          mppt1_A
          mppt2_V
          mppt2_A
          heatsink_C
          total_generation_Wh
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { pv: { latest: PVData | null } }
  }>(query, credentials);

  return data.data.pv?.latest;
}
```

### Get Battery Data

```typescript
async function getBatteryData(derSn: string, credentials: AuthCredentials) {
  const query = `{
    data {
      battery(sn: "${derSn}") {
        latest {
          timestamp
          W
          A
          V
          SoC_nom_fract
          heatsink_C
          total_charge_Wh
          total_discharge_Wh
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { battery: { latest: BatteryData | null } }
  }>(query, credentials);

  return data.data.battery?.latest;
}
```

### Get Meter Data

```typescript
async function getMeterData(derSn: string, credentials: AuthCredentials) {
  const query = `{
    data {
      meter(sn: "${derSn}") {
        latest {
          timestamp
          W
          Hz
          L1_V
          L1_A
          L1_W
          L2_V
          L2_A
          L2_W
          L3_V
          L3_A
          L3_W
          total_import_Wh
          total_export_Wh
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { meter: { latest: MeterData | null } }
  }>(query, credentials);

  return data.data.meter?.latest;
}
```

---

## Time Series Data

### Query Time Series

All DER types support time series queries with `from`, `to`, and `resolution` parameters.

```typescript
interface TimeSeriesPoint {
  start: string;  // ISO timestamp (note: field is 'start', not 'timestamp')
  W: number | null;
}

async function getLoadTimeSeries(
  siteId: string,
  from: Date,
  to: Date,
  resolution: string,
  credentials: AuthCredentials
): Promise<TimeSeriesPoint[]> {
  const query = `{
    data {
      load(siteId: "${siteId}") {
        timeSeries(
          from: "${from.toISOString()}"
          to: "${to.toISOString()}"
          resolution: "${resolution}"
        ) {
          start
          W
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { load: { timeSeries: TimeSeriesPoint[] | null } }
  }>(query, credentials);

  return data.data.load?.timeSeries || [];
}
```

### Resolution Options

| Resolution | Use Case | Data Points (24h) |
|------------|----------|-------------------|
| `1m` | Real-time monitoring | 1,440 |
| `5m` | Short-term analysis | 288 |
| `15m` | Daily overview | 96 |
| `1h` | Weekly trends | 24 |
| `1d` | Monthly analysis | 1 |

### Adaptive Resolution Strategy

For optimal performance, adjust resolution based on time range:

```typescript
function getResolutionForRange(range: string): string {
  if (range.includes('7d')) return '1h';   // 168 points
  if (range.includes('24h')) return '15m'; // 96 points
  if (range.includes('6h')) return '5m';   // 72 points
  return '1m';                              // 60 points for 1h
}
```

### PV Time Series

```typescript
async function getPVTimeSeries(
  derSn: string,
  from: Date,
  to: Date,
  resolution: string,
  credentials: AuthCredentials
) {
  const query = `{
    data {
      pv(sn: "${derSn}") {
        timeSeries(
          from: "${from.toISOString()}"
          to: "${to.toISOString()}"
          resolution: "${resolution}"
        ) {
          start
          W
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { pv: { timeSeries: TimeSeriesPoint[] | null } }
  }>(query, credentials);

  return data.data.pv?.timeSeries || [];
}
```

### Battery Time Series

```typescript
async function getBatteryTimeSeries(
  derSn: string,
  from: Date,
  to: Date,
  resolution: string,
  credentials: AuthCredentials
) {
  const query = `{
    data {
      battery(sn: "${derSn}") {
        timeSeries(
          from: "${from.toISOString()}"
          to: "${to.toISOString()}"
          resolution: "${resolution}"
        ) {
          start
          W
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { battery: { timeSeries: TimeSeriesPoint[] | null } }
  }>(query, credentials);

  return data.data.battery?.timeSeries || [];
}
```

### Meter Time Series

```typescript
async function getMeterTimeSeries(
  derSn: string,
  from: Date,
  to: Date,
  resolution: string,
  credentials: AuthCredentials
) {
  const query = `{
    data {
      meter(sn: "${derSn}") {
        timeSeries(
          from: "${from.toISOString()}"
          to: "${to.toISOString()}"
          resolution: "${resolution}"
        ) {
          start
          W
        }
      }
    }
  }`;

  const data = await graphqlQuery<{
    data: { meter: { timeSeries: TimeSeriesPoint[] | null } }
  }>(query, credentials);

  return data.data.meter?.timeSeries || [];
}
```

---

## Complete Code Examples

### Full Site Overview Fetcher

```typescript
interface SiteOverview {
  site_id: string;
  timestamp: string;
  total_pv_power_w: number;
  total_battery_power_w: number;
  total_grid_power_w: number;
  load_w: number;
  battery_soc_avg: number | null;
  ders: DERInfo[];
}

interface DERInfo {
  type: string;
  device_serial: string;
  power_w: number;
  data: Record<string, unknown>;
}

async function getSiteOverview(
  siteId: string,
  credentials: AuthCredentials
): Promise<SiteOverview> {
  // 1. Get site structure
  const siteQuery = `{
    sites {
      list {
        id
        devices {
          rawSn
          ders {
            derSn
            settings { key value }
          }
        }
      }
    }
  }`;

  const siteData = await graphqlQuery<{ sites: { list: Site[] } }>(
    siteQuery,
    credentials
  );
  const site = siteData.sites.list.find(s => s.id === siteId);
  if (!site) throw new Error(`Site ${siteId} not found`);

  // 2. Categorize DERs
  const ders: { type: string; derSn: string; deviceSn: string; isPrimary?: boolean }[] = [];

  for (const device of site.devices) {
    for (const der of device.ders) {
      const derSn = der.derSn.toLowerCase();
      const isPrimary = der.settings?.some(
        s => s.key === 'DEFAULT_ENERGY_METER' && s.value === 'true'
      );

      let type = 'unknown';
      if (derSn.startsWith('pv-')) type = 'pv';
      else if (derSn.startsWith('bt-')) type = 'battery';
      else if (derSn.startsWith('em-')) type = 'meter';
      else if (derSn.startsWith('ch-')) type = 'charger';

      ders.push({ type, derSn: der.derSn, deviceSn: device.rawSn, isPrimary });
    }
  }

  // 3. Fetch load data
  const loadQuery = `{
    data {
      load(siteId: "${siteId}") {
        latest { timestamp W }
      }
    }
  }`;
  const loadData = await graphqlQuery<{
    data: { load: { latest: { W: number } | null } }
  }>(loadQuery, credentials);
  const loadPower = loadData.data.load?.latest?.W || 0;

  // 4. Fetch all DER data
  let totalPvPower = 0;
  let totalBatteryPower = 0;
  let totalGridPower = 0;
  const derInfos: DERInfo[] = [];
  const batterySocs: number[] = [];

  for (const der of ders) {
    try {
      if (der.type === 'pv') {
        const data = await getPVData(der.derSn, credentials);
        if (data) {
          totalPvPower += data.W || 0;
          derInfos.push({
            type: 'pv',
            device_serial: der.deviceSn,
            power_w: data.W || 0,
            data,
          });
        }
      } else if (der.type === 'battery') {
        const data = await getBatteryData(der.derSn, credentials);
        if (data) {
          totalBatteryPower += data.W || 0;
          if (data.SoC_nom_fract !== null) {
            batterySocs.push(data.SoC_nom_fract);
          }
          derInfos.push({
            type: 'battery',
            device_serial: der.deviceSn,
            power_w: data.W || 0,
            data,
          });
        }
      } else if (der.type === 'meter') {
        const data = await getMeterData(der.derSn, credentials);
        if (data) {
          if (der.isPrimary) {
            totalGridPower += data.W || 0;
          }
          derInfos.push({
            type: 'meter',
            device_serial: der.deviceSn,
            power_w: data.W || 0,
            data: { ...data, isPrimary: der.isPrimary },
          });
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch ${der.type} data for ${der.derSn}:`, e);
    }
  }

  return {
    site_id: siteId,
    timestamp: new Date().toISOString(),
    total_pv_power_w: totalPvPower,
    total_battery_power_w: totalBatteryPower,
    total_grid_power_w: totalGridPower || (loadPower - totalPvPower - totalBatteryPower),
    load_w: loadPower,
    battery_soc_avg: batterySocs.length > 0
      ? batterySocs.reduce((a, b) => a + b, 0) / batterySocs.length
      : null,
    ders: derInfos,
  };
}
```

### React Hook for Real-Time Data

```typescript
import { useState, useEffect, useCallback } from 'react';

function useSiteData(siteId: string, credentials: AuthCredentials | null) {
  const [data, setData] = useState<SiteOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!credentials) return;

    try {
      const overview = await getSiteOverview(siteId, credentials);
      setData(overview);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [siteId, credentials]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
```

---

## Best Practices

### 1. Cache Credentials

Store authentication credentials in localStorage with expiration checking to avoid repeated wallet signing.

### 2. Use Adaptive Resolution

Adjust time series resolution based on the requested time range to maintain performance.

### 3. Handle Missing Data Gracefully

DER data may be `null` when devices are offline. Always provide fallback values:

```typescript
const power = data.W ?? 0;
const soc = data.SoC_nom_fract ?? null;
```

### 4. Aggregate Multiple DERs

Sites may have multiple PV inverters, batteries, or meters. Sum their values for totals:

```typescript
const totalPvPower = pvDers.reduce((sum, der) => sum + (der.power_w || 0), 0);
```

### 5. Identify Primary Meter

Check the `DEFAULT_ENERGY_METER` setting to identify the primary grid meter:

```typescript
const isPrimary = der.settings?.some(
  s => s.key === 'DEFAULT_ENERGY_METER' && s.value === 'true'
);
```

### 6. Use Device Serial for Display

Use `rawSn` (device serial number) for user-facing displays, not `derSn` (DER identifier):

```typescript
// ✅ Show device serial: "25119985"
device_serial: device.rawSn

// ❌ Don't show DER ID: "bt-snDZd6DDMfwhfl1KFInZYT..."
device_serial: der.derSn
```

### 7. Buffer Polyfill for Browser

The `bs58` library requires Node.js `Buffer`. Add this polyfill:

```typescript
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}
```

### 8. Error Handling

Wrap API calls in try-catch and provide user-friendly error messages:

```typescript
try {
  const data = await graphqlQuery(query, credentials);
  return data;
} catch (error) {
  if (error.message.includes('401')) {
    throw new Error('Authentication expired. Please sign in again.');
  }
  throw new Error('Failed to load data. Please try again.');
}
```

---

## Troubleshooting

### "Field does not specify a requested resource"

You're using GraphQL variables, which aren't supported. Use inline values:

```typescript
// ❌ Won't work
query GetData($siteId: String!) { ... }

// ✅ Works
`{ data { load(siteId: "${siteId}") { ... } } }`
```

### "Cannot query field 'timestamp' on type 'LoadDataPoint'"

Time series data uses `start` instead of `timestamp`:

```typescript
// ❌ Wrong
timeSeries { timestamp W }

// ✅ Correct
timeSeries { start W }
```

### "Buffer is not defined"

Add the Buffer polyfill before importing bs58:

```typescript
import { Buffer } from 'buffer';
window.Buffer = Buffer;
```

### 401 Unauthorized

- Check that credentials haven't expired
- Verify the message format matches exactly
- Ensure both headers are Base58 encoded
- Confirm the signature is from the correct wallet

### Empty Data Returned

- Device may be offline
- Site ID may be incorrect
- DER serial number may be wrong (check `derSn` format)

---

## Summary

Building on the Sourceful Energy API involves:

1. **Authenticating** with Ed25519 wallet signatures
2. **Discovering** sites and their DER structure
3. **Querying** real-time data from PV, battery, and meter endpoints
4. **Visualizing** time series data with appropriate resolution
5. **Handling** multiple devices and graceful error recovery

With these building blocks, you can create powerful energy management applications that provide real-time insights into solar production, battery storage, and grid consumption.

---

## Resources

- **API Endpoint**: `https://api-vnext.srcful.dev/`
- **Privy Documentation**: https://docs.privy.io
- **Solana Web3.js**: https://solana-labs.github.io/solana-web3.js/

---

*This guide was created based on practical implementation experience building the Sourceful EMS Dashboard.*
