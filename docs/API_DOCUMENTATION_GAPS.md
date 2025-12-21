# Sourceful API Documentation: Gaps & Recommendations

This document outlines missing elements in the current Sourceful Energy API documentation, based on hands-on implementation experience. Each section provides concrete recommendations for improvement.

---

## Executive Summary

During the development of an external application using the Sourceful API, we encountered several documentation gaps that required trial-and-error discovery. Addressing these gaps would significantly improve the developer experience and reduce integration time.

**Critical Missing Items:**
1. Authentication flow documentation
2. GraphQL schema reference
3. Field naming conventions (especially `start` vs `timestamp`)
4. Variable support limitations
5. Error code reference

---

## 1. Authentication Documentation

### What's Missing

The authentication mechanism using Ed25519 wallet signatures is completely undocumented.

### What Developers Need to Know

| Item | Currently Documented | Required |
|------|---------------------|----------|
| Message format | ❌ No | Full template with placeholders |
| Encoding format (Base58) | ❌ No | Specification of encoding |
| Header names | ❌ No | `x-auth-message`, `x-auth-signature` |
| Expiration handling | ❌ No | How long credentials are valid |
| Wallet types supported | ❌ No | Solana, Ed25519 requirement |

### Recommended Documentation

```markdown
## Authentication

The Sourceful API uses Ed25519 wallet signatures for authentication.

### Message Format

```
Sourceful Energy EMS Dashboard wants you to sign data with your Solana account:
{WALLET_ADDRESS}

Grant basic application access

Issued At (UTC): {ISO_8601_TIMESTAMP}
Expiration Time (UTC): {ISO_8601_TIMESTAMP}
```

### Headers

| Header | Description |
|--------|-------------|
| `x-auth-message` | Base58-encoded authentication message |
| `x-auth-signature` | Base58-encoded Ed25519 signature |

### Example

```bash
curl -X POST "https://api-vnext.srcful.dev/" \
  -H "Content-Type: application/json" \
  -H "x-auth-message: {BASE58_MESSAGE}" \
  -H "x-auth-signature: {BASE58_SIGNATURE}" \
  -d '{"query":"{ sites { list { id } } }"}'
```
```

---

## 2. GraphQL Schema Reference

### What's Missing

No public schema documentation or introspection guide exists.

### What Developers Need

1. **Complete type definitions** for all queryable types
2. **Field descriptions** explaining what each field represents
3. **Units of measurement** (W, Wh, V, A, Hz, °C, fraction vs percentage)
4. **Nullable field indicators**

### Recommended Schema Documentation

```graphql
"""
Site represents a physical location with energy equipment.
"""
type SiteV2 {
  "Unique site identifier (UUID)"
  id: String!

  "List of hardware devices at this site"
  devices: [DeviceV2!]!

  "Site-level configuration settings"
  settings: [SettingsV2!]
}

"""
Device represents a physical hardware unit (inverter, gateway, etc.)
"""
type DeviceV2 {
  "Device serial number (manufacturer's S/N)"
  rawSn: String!

  "Distributed Energy Resources connected to this device"
  ders: [DerV2!]!

  "Device configuration settings"
  settings: [SettingsV2!]
}

"""
DER (Distributed Energy Resource) - PV, Battery, Meter, etc.
"""
type DerV2 {
  "DER identifier (format: {type}-{hash}, e.g., 'pv-abc123...')"
  derSn: String!

  "Gateway identifier"
  gwId: String!

  "DER-specific settings including TYPE and DEFAULT_ENERGY_METER"
  settings: [SettingsV2!]
}

"""
Real-time PV inverter data
"""
type PVLatestData {
  "ISO 8601 timestamp of measurement"
  timestamp: String!

  "Power output in Watts (positive = generating)"
  W: Float

  "MPPT 1 voltage in Volts"
  mppt1_V: Float

  "MPPT 1 current in Amps"
  mppt1_A: Float

  "MPPT 2 voltage in Volts"
  mppt2_V: Float

  "MPPT 2 current in Amps"
  mppt2_A: Float

  "Heatsink temperature in Celsius"
  heatsink_C: Float

  "Cumulative energy generated in Watt-hours"
  total_generation_Wh: Float
}

"""
Real-time battery data
"""
type BatteryLatestData {
  timestamp: String!

  "Power in Watts (positive = charging, negative = discharging)"
  W: Float

  "Current in Amps"
  A: Float

  "Voltage in Volts"
  V: Float

  "State of Charge as fraction (0.0 to 1.0, NOT percentage)"
  SoC_nom_fract: Float

  "Heatsink temperature in Celsius"
  heatsink_C: Float

  "Cumulative energy charged in Watt-hours"
  total_charge_Wh: Float

  "Cumulative energy discharged in Watt-hours"
  total_discharge_Wh: Float
}

"""
Real-time meter data (grid connection)
"""
type MeterLatestData {
  timestamp: String!

  "Total power in Watts (positive = import, negative = export)"
  W: Float

  "Grid frequency in Hz"
  Hz: Float

  "Phase 1 voltage in Volts"
  L1_V: Float
  "Phase 1 current in Amps"
  L1_A: Float
  "Phase 1 power in Watts"
  L1_W: Float

  "Phase 2 voltage in Volts"
  L2_V: Float
  "Phase 2 current in Amps"
  L2_A: Float
  "Phase 2 power in Watts"
  L2_W: Float

  "Phase 3 voltage in Volts"
  L3_V: Float
  "Phase 3 current in Amps"
  L3_A: Float
  "Phase 3 power in Watts"
  L3_W: Float

  "Cumulative energy imported in Watt-hours"
  total_import_Wh: Float

  "Cumulative energy exported in Watt-hours"
  total_export_Wh: Float
}
```

---

## 3. Critical: Field Naming Inconsistencies

### The Problem

Time series responses use `start` while latest data uses `timestamp`. This caused errors during development.

| Query Type | Field Name | Example Value |
|------------|------------|---------------|
| `latest` | `timestamp` | `"2025-12-21T12:00:00Z"` |
| `timeSeries` | `start` | `"2025-12-21T12:00:00Z"` |

### Impact

Developers receive cryptic errors like:
```
Cannot query field 'timestamp' on type 'LoadDataPoint'
```

### Recommendation

1. **Document this explicitly** in the schema
2. **Consider aliasing** to allow both field names
3. **Add to "Common Gotchas" section** in docs

```markdown
## Important: Time Field Names

- Use `timestamp` for `latest` queries
- Use `start` for `timeSeries` queries

```graphql
# Latest data
{ data { load(siteId: "...") { latest { timestamp W } } } }

# Time series data
{ data { load(siteId: "...") { timeSeries(...) { start W } } } }
```
```

---

## 4. GraphQL Variables Not Supported

### The Problem

Standard GraphQL variable syntax does not work:

```graphql
# ❌ This fails silently or with confusing errors
query GetData($siteId: String!) {
  data {
    load(siteId: $siteId) { ... }
  }
}
```

### Impact

- Developers familiar with GraphQL expect variables to work
- Error messages don't clearly indicate this limitation
- Security implications (SQL injection-style concerns with string interpolation)

### Recommendation

1. **Document prominently** that variables are not supported
2. **Provide examples** using inline values
3. **Explain security considerations** for string interpolation
4. **Consider adding variable support** in a future version

```markdown
## Important: GraphQL Variables

The Sourceful API does not currently support GraphQL variables.
All values must be inlined directly in the query string.

```javascript
// ❌ Variables NOT supported
const query = `
  query GetData($siteId: String!) {
    data { load(siteId: $siteId) { ... } }
  }
`;
fetch(API, { body: JSON.stringify({ query, variables: { siteId } }) });

// ✅ Inline values
const query = `{
  data { load(siteId: "${siteId}") { ... } }
}`;
fetch(API, { body: JSON.stringify({ query }) });
```

**Security Note:** When inlining values, ensure proper escaping of user input.
```

---

## 5. Time Series Query Parameters

### What's Missing

- Available resolution values
- Maximum time range limits
- Data retention period
- Rate limiting information

### What Developers Need

```markdown
## Time Series Queries

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | ISO 8601 | Yes | Start of time range |
| `to` | ISO 8601 | Yes | End of time range |
| `resolution` | String | Yes | Aggregation window |

### Supported Resolutions

| Value | Description | Max Range |
|-------|-------------|-----------|
| `1m` | 1 minute | 24 hours |
| `5m` | 5 minutes | 7 days |
| `15m` | 15 minutes | 30 days |
| `1h` | 1 hour | 90 days |
| `1d` | 1 day | 1 year |

### Data Retention

Historical data is available for up to [X] days/months/years.

### Rate Limits

- Maximum [X] requests per minute
- Maximum [X] data points per request
```

---

## 6. DER Type Prefixes

### What's Missing

Documentation of the DER serial number prefix convention.

### Recommendation

```markdown
## DER Identification

DER serial numbers (`derSn`) follow a prefix convention:

| Prefix | Type | Description |
|--------|------|-------------|
| `pv-` | Solar | Photovoltaic inverter |
| `bt-` | Battery | Battery storage system |
| `em-` | Meter | Energy meter (grid connection) |
| `ch-` | Charger | EV charger |

### Example
```
pv-c458HFqzmuN8JaVUErEUI4LVuNEs9S5FiUPHME4Qovni...
bt-snDZd6DDMfwhfl1KFInZYTayygdbhVqML5InzTS9j5Mg...
em-snDZd6DDMfwhfl1KFInZYTayygdbhVqML5InzTS9j5Mg...
```
```

---

## 7. Settings Keys Documentation

### What's Missing

Documentation of available settings keys and their values.

### Known Settings

| Key | Values | Description |
|-----|--------|-------------|
| `TYPE` | `Solar`, `Battery`, `EnergyMeter` | DER type identifier |
| `DEFAULT_ENERGY_METER` | `true`, `false` | Primary meter flag |

### Recommendation

Document all available settings keys, their possible values, and their purpose.

---

## 8. Error Response Format

### What's Missing

Documentation of error response structure and common error codes.

### Recommendation

```markdown
## Error Handling

### Error Response Format

```json
{
  "data": null,
  "errors": [
    {
      "message": "Error description",
      "locations": [{ "line": 1, "column": 10 }],
      "path": ["data", "load"]
    }
  ]
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired credentials | Re-authenticate with wallet |
| `Field 'X' does not exist` | Invalid field name | Check schema for correct field |
| `does not specify a requested resource` | Missing required parameter | Provide required argument |
```

---

## 9. Load vs Individual DERs

### What's Missing

Explanation of what `load(siteId)` represents vs querying individual DERs.

### Recommendation

```markdown
## Understanding Load Data

The `load(siteId: "...")` query returns the **calculated total consumption**
for a site, which may differ from individual meter readings.

### Relationship

```
Load ≈ Grid Import + PV Production - Battery Charging
```

### When to Use Each

| Query | Use Case |
|-------|----------|
| `load(siteId)` | Total site consumption |
| `meter(sn)` | Individual grid meter reading |
| `pv(sn)` | Individual PV inverter |
| `battery(sn)` | Individual battery |
```

---

## 10. Device Serial vs DER Serial

### What's Missing

Clear explanation of `rawSn` vs `derSn`.

### The Confusion

- `rawSn`: Physical device serial number (e.g., "25119985")
- `derSn`: Logical DER identifier (e.g., "bt-snDZd6DDMfwhfl1...")

### Recommendation

```markdown
## Identifiers

### Device Serial (`rawSn`)
The manufacturer's serial number printed on the physical device.
Use this for display to users.

**Example:** `"25119985"`, `"A2332407312"`

### DER Serial (`derSn`)
Internal identifier for the Distributed Energy Resource.
Use this for API queries.

**Example:** `"pv-c458HFqzmuN8JaVUErEUI4LVuNEs9S5FiUPHME4Qovni..."`

### Querying

```graphql
# Use derSn for data queries
{ data { pv(sn: "pv-c458HFqz...") { latest { W } } } }

# Display rawSn to users
devices { rawSn }  # Shows "25119985"
```
```

---

## 11. Missing: Device Metadata

### The Gap

No way to query device make/model/manufacturer information via API.

### Current State

- `rawSn` (serial number) is available
- `make`, `model`, `manufacturer` fields do not exist

### Impact

Applications cannot display device brand information without maintaining a separate mapping.

### Recommendation

Consider adding device metadata fields:

```graphql
type DeviceV2 {
  rawSn: String!
  make: String        # e.g., "Ferroamp", "SolarEdge"
  model: String       # e.g., "SSO-40", "SE10K"
  manufacturer: String
  firmwareVersion: String
  ders: [DerV2!]!
}
```

---

## 12. API Versioning

### What's Missing

- API version information
- Deprecation policy
- Migration guides
- Changelog

### Recommendation

```markdown
## API Versioning

Current version: `v2` (api-vnext.srcful.dev)

### Version History

| Version | Status | End of Life |
|---------|--------|-------------|
| v2 | Current | - |
| v1 | Deprecated | 2025-06-01 |

### Breaking Changes Policy

- 6 month notice for breaking changes
- Deprecation warnings in responses
- Migration guide provided
```

---

## Summary: Priority Recommendations

### Critical (Block Integration)
1. ✅ Authentication documentation
2. ✅ GraphQL variables limitation
3. ✅ `start` vs `timestamp` field naming

### High Priority (Significant Developer Friction)
4. Complete schema reference with descriptions
5. Time series parameters and limits
6. Error code reference
7. DER prefix conventions

### Medium Priority (Quality of Life)
8. Settings keys documentation
9. Load calculation explanation
10. Device vs DER serial explanation

### Nice to Have (Feature Requests)
11. Device metadata fields (make/model)
12. API versioning and changelog
13. Interactive API explorer (GraphiQL)
14. SDK/client library

---

## Appendix: Proposed Documentation Structure

```
docs/
├── getting-started/
│   ├── authentication.md      # Complete auth guide
│   ├── quick-start.md         # First API call in 5 minutes
│   └── concepts.md            # Sites, Devices, DERs explained
├── api-reference/
│   ├── schema.md              # Complete GraphQL schema
│   ├── queries.md             # All available queries
│   ├── types.md               # Type definitions
│   └── errors.md              # Error codes and handling
├── guides/
│   ├── real-time-data.md      # Fetching latest data
│   ├── time-series.md         # Historical data queries
│   ├── multi-device.md        # Handling multiple DERs
│   └── best-practices.md      # Performance and patterns
├── examples/
│   ├── javascript/
│   ├── python/
│   └── curl/
└── changelog.md
```

---

*Document prepared based on integration experience with the Sourceful Energy API, December 2025.*
