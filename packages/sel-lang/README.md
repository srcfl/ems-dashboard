# SEL - Sourceful Energy Language

A domain-specific language for energy automation rules.

## Overview

SEL (Sourceful Energy Language) is a simple, human-readable language designed for creating energy automation rules. It allows users to define conditions based on energy metrics (solar power, battery state, grid usage) and trigger actions like notifications and webhooks.

## Features

- **Simple, readable syntax** - Easy to write and understand
- **Event-driven rules** - React to metric thresholds and conditions
- **Scheduled rules** - Execute actions at specific times
- **Trend detection** - Detect rising, falling, or stable trends
- **Anomaly detection** - Compare to historical data
- **Statistical functions** - AVG, MEDIAN, MAX, MIN, SUM, etc.
- **Compound conditions** - AND, OR, NOT operators
- **JSON export** - Compile to JSON for runtime execution
- **WASM support** - Run in the browser (coming soon)

## Quick Start

```rust
use sel_lang::*;

let source = r#"
    $low_battery = 20%

    ON battery_soc < $low_battery
      NOTIFY "Battery low: {battery_soc}"
      COOLDOWN 30min
"#;

// Parse and compile
let json = parse_and_compile(source).unwrap();
println!("{}", json);
```

## Language Syntax

### Variables

Define reusable values with `$`:

```sel
$threshold = 20%          // Percentage
$min_power = 3kW          // Power (W, kW, MW)
$daily_target = 10kWh     // Energy (Wh, kWh, MWh)
$check_time = 17:00       // Time
$interval = 30min         // Duration (s, min, hour, day, week)
```

### Event Rules

Trigger actions when conditions are met:

```sel
ON battery_soc < 20%
  NOTIFY "Battery is low!"
  COOLDOWN 15min

ON pv_power > $threshold AND battery_soc < 80%
  WEBHOOK "https://api.example.com/charge"
```

### Scheduled Rules

Execute actions at specific times:

```sel
EVERY day AT 18:00
  NOTIFY "Daily energy summary ready"

EVERY monday AT 09:00
  NOTIFY "Weekly report available"

EVERY week AT 08:00
  WEBHOOK "https://api.example.com/weekly-report"
```

### Available Metrics

| Metric | Description |
|--------|-------------|
| `pv_power` | Solar panel power output (W) |
| `battery_power` | Battery charge/discharge power (W) |
| `battery_soc` | Battery state of charge (%) |
| `grid_power` | Net grid power (W) |
| `grid_import` | Power imported from grid (W) |
| `grid_export` | Power exported to grid (W) |
| `load_power` | Total load consumption (W) |

### Comparison Operators

| Operator | Meaning |
|----------|---------|
| `<` | Less than |
| `<=` | Less than or equal |
| `>` | Greater than |
| `>=` | Greater than or equal |
| `==` | Equal |
| `!=` | Not equal |

### Logical Operators

```sel
// AND - both conditions must be true
ON battery_soc < 20% AND pv_power > 1kW
  NOTIFY "Low battery but sun is shining"

// OR - either condition must be true
ON battery_soc < 10% OR battery_soc > 95%
  NOTIFY "Battery at extreme level"

// NOT - negate a condition
ON NOT pv_power > 0
  NOTIFY "No solar production"

// Parentheses for complex logic
ON (battery_soc < 20% OR battery_soc > 90%) AND pv_power > 1kW
  NOTIFY "Battery extreme while producing"
```

### Trend Detection

React to changing values:

```sel
ON battery_soc RISING
  NOTIFY "Battery is charging"

ON pv_power FALLING
  NOTIFY "Solar production decreasing"

ON grid_power STABLE
  NOTIFY "Grid usage is stable"
```

### Anomaly Detection

Compare to historical data:

```sel
ON pv_power IS UNUSUAL COMPARED TO 7day
  NOTIFY "Solar production is abnormal"
```

### Statistical Functions

Aggregate data over time:

```sel
ON AVG(pv_power, 1hour) > 5kW
  NOTIFY "Sustained high solar production"

ON MAX(battery_soc) > 95%
  NOTIFY "Battery reached full charge"

ON MIN(grid_power, 24hour) < 0
  NOTIFY "Exported power today"
```

Available functions: `AVG`, `MEDIAN`, `SUM`, `MIN`, `MAX`, `COUNT`, `STDDEV`, `TREND`, `PERCENTILE`

### Actions

#### NOTIFY
Send a notification:

```sel
NOTIFY "Your message here"
```

#### WEBHOOK
Call an external URL:

```sel
WEBHOOK "https://api.example.com/alert"
```

#### COOLDOWN
Prevent repeated triggers:

```sel
ON battery_soc < 20%
  NOTIFY "Low battery"
  COOLDOWN 30min    // Wait 30 minutes before triggering again
```

## Building

### Requirements

- Rust 1.70 or later

### Build

```bash
cargo build --release
```

### Test

```bash
cargo test
```

### Build with WASM support

```bash
cargo build --release --features wasm
```

## JSON Output Format

Compiled SEL programs produce JSON suitable for runtime execution:

```json
{
  "version": "1.0",
  "compiled_at": "1703980800",
  "checksum": "abc123",
  "variables": [
    {
      "name": "threshold",
      "value": 0.2,
      "original": { "type": "Percent", "value": 20.0 }
    }
  ],
  "rules": [
    {
      "id": "rule_123",
      "name": null,
      "rule_type": {
        "type": "Event",
        "condition": { ... }
      },
      "enabled": true,
      "actions": [
        {
          "action_type": "notify",
          "config": { "message": { ... } },
          "template_vars": ["battery_soc"]
        }
      ],
      "cooldown_seconds": 1800
    }
  ],
  "required_metrics": ["battery_soc"],
  "requires_history": false,
  "max_history_seconds": null
}
```

## API

### Parse

```rust
use sel_lang::parse;

let program = parse("ON battery_soc < 20%")?;
```

### Compile to JSON

```rust
use sel_lang::{parse, compile_to_json};

let program = parse(source)?;
let json = compile_to_json(&program)?;
```

### Parse and Compile

```rust
use sel_lang::parse_and_compile;

let json = parse_and_compile(source)?;
```

## Examples

### Complete Energy Monitoring Setup

```sel
// Configuration
$low_battery = 20%
$high_battery = 90%
$high_solar = 8kW
$report_time = 18:00

// Low battery alert
ON battery_soc < $low_battery
  NOTIFY "Battery critically low!"
  WEBHOOK "https://api.example.com/alert"
  COOLDOWN 15min

// High production celebration
ON pv_power > $high_solar
  NOTIFY "Excellent solar production!"
  COOLDOWN 1hour

// Battery nearly full
ON battery_soc > $high_battery AND pv_power > 1kW
  NOTIFY "Battery almost full, consider using power"
  COOLDOWN 30min

// Daily summary
EVERY day AT $report_time
  NOTIFY "Daily energy report ready"
  WEBHOOK "https://api.example.com/daily-report"

// Weekly analysis
EVERY monday AT 09:00
  NOTIFY "Weekly energy analysis available"
```

## License

MIT License - Sourceful Energy AB
