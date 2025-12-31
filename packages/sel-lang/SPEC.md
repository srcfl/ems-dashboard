# SEL Language Specification v1.0

**Sourceful Energy Language (SEL)**
Version: 1.0.0
Date: 2024-12-31
Status: Final Draft

## 1. Introduction

SEL (Sourceful Energy Language) is a domain-specific language designed for creating energy automation rules. It enables users to define event-driven and time-scheduled automation rules that monitor energy metrics and trigger notifications.

### 1.1 Design Goals

1. **Human-readable** - Non-programmers should be able to read and write rules
2. **Declarative** - Describe what should happen, not how
3. **Safe** - No side effects beyond defined actions
4. **Deterministic** - Same input always produces same output
5. **English-only** - All keywords, metrics, and output in English

### 1.2 Scope

SEL v1.0 focuses on:
- Monitoring energy metrics (solar, battery, grid, load)
- Triggering notifications (NOTIFY, WEBHOOK)
- Event-driven rules (ON condition)
- Time-scheduled rules (EVERY schedule)
- Trend detection (RISING, FALLING, STABLE)
- Statistical aggregation (AVG, MAX, MIN, etc.)

Out of scope for v1.0:
- Device control actions
- Query/reporting language
- Visualization definitions
- Machine learning predictions

## 2. Lexical Structure

### 2.1 Character Set

SEL source code uses UTF-8 encoding. Keywords and identifiers are ASCII-only and case-sensitive.

### 2.2 Whitespace

Whitespace (spaces, tabs, newlines) separates tokens and is otherwise insignificant, except:
- Indentation is conventionally 2 spaces for actions under rules (not enforced)
- Line breaks separate statements

### 2.3 Comments

Single-line comments start with `#` and continue to end of line:

```sel
# This is a comment
ON battery_soc < 20%  # Inline comment
```

### 2.4 Identifiers

**Variables** start with `$` followed by letters, digits, or underscores:
```
$threshold
$low_battery_level
$max_power_1
```

**Metrics** are predefined lowercase identifiers with underscores:
```
pv_power
battery_soc
grid_import
```

### 2.5 Literals

#### 2.5.1 Numbers

Decimal numbers with optional decimal point:
```
42
3.14
0.5
```

#### 2.5.2 Percentages

Number followed by `%`:
```
20%
85.5%
```

Normalized to 0.0-1.0 range internally (20% → 0.2).

#### 2.5.3 Power Values

Number followed by power unit (W, kW, MW):
```
500W
3.5kW
1MW
```

Normalized to Watts internally (3.5kW → 3500).

#### 2.5.4 Energy Values

Number followed by energy unit (Wh, kWh, MWh):
```
100Wh
15kWh
2MWh
```

Normalized to Watt-hours internally (15kWh → 15000).

#### 2.5.5 Duration Values

Number followed by duration unit (s, min, hour, day, week):
```
30s
15min
1hour
7day
2week
```

Normalized to seconds internally (15min → 900).

#### 2.5.6 Time Values

Time in HH:MM format (24-hour):
```
09:00
17:30
23:59
```

#### 2.5.7 String Literals

Double-quoted strings with template variable support:
```
"Hello world"
"Battery at {battery_soc}%"
```

Template variables use `{metric_name}` syntax.

## 3. Grammar

### 3.1 Program Structure

A SEL program consists of:
1. Zero or more variable definitions
2. One or more rules

```
program     → (variable | rule)* EOF
variable    → '$' IDENTIFIER '=' value
rule        → event_rule | schedule_rule
```

### 3.2 Variable Definitions

Variables store reusable values:

```sel
$threshold = 20%
$min_power = 3kW
$check_time = 17:00
$cooldown = 30min
```

Variable names must be unique within a program.

### 3.3 Event Rules

Event rules trigger when conditions become true:

```
event_rule  → 'ON' condition action+ cooldown?
condition   → comparison | trend | anomaly | logical
action      → notify | webhook | log | set
cooldown    → 'COOLDOWN' duration
```

Example:
```sel
ON battery_soc < 20%
  NOTIFY "Battery low!"
  COOLDOWN 15min
```

### 3.4 Schedule Rules

Schedule rules trigger at specific times:

```
schedule_rule → 'EVERY' frequency 'AT' time action+
frequency     → 'day' | 'daily' | 'week' | 'weekly'
              | 'month' | 'monthly' | weekday
weekday       → 'monday' | 'tuesday' | 'wednesday'
              | 'thursday' | 'friday' | 'saturday' | 'sunday'
```

Examples:
```sel
EVERY day AT 18:00
  NOTIFY "Daily summary"

EVERY monday AT 09:00
  NOTIFY "Weekly report"
```

### 3.5 Conditions

#### 3.5.1 Comparison Conditions

```
comparison  → operand operator operand
operand     → metric | function_call | variable_ref | literal
operator    → '<' | '<=' | '>' | '>=' | '==' | '!='
```

Examples:
```sel
battery_soc < 20%
pv_power > $threshold
grid_import >= 5kW
```

#### 3.5.2 Logical Conditions

```
logical     → condition 'AND' condition
            | condition 'OR' condition
            | 'NOT' condition
            | '(' condition ')'
```

Precedence (highest to lowest): NOT, AND, OR

Examples:
```sel
battery_soc < 20% AND pv_power > 1kW
battery_soc < 10% OR battery_soc > 95%
NOT pv_power > 0
(battery_soc < 20% OR battery_soc > 90%) AND pv_power > 1kW
```

#### 3.5.3 Trend Conditions

```
trend       → metric ('RISING' | 'FALLING' | 'STABLE')
```

Examples:
```sel
battery_soc RISING
pv_power FALLING
grid_power STABLE
```

#### 3.5.4 Anomaly Conditions

```
anomaly     → metric 'IS' 'UNUSUAL' 'COMPARED' 'TO' duration
```

Example:
```sel
pv_power IS UNUSUAL COMPARED TO 7day
```

### 3.6 Function Calls

Statistical functions aggregate metric values over time:

```
function_call → function_name '(' metric (',' duration)? ')'
function_name → 'AVG' | 'MEDIAN' | 'SUM' | 'MIN' | 'MAX'
              | 'COUNT' | 'STDDEV' | 'TREND' | 'PERCENTILE'
```

Examples:
```sel
AVG(pv_power, 1hour)
MAX(battery_soc)
MIN(grid_power, 24hour)
```

### 3.7 Actions

#### 3.7.1 NOTIFY

Send a notification message:

```
notify      → 'NOTIFY' string_literal
```

Example:
```sel
NOTIFY "Battery at {battery_soc}%"
```

#### 3.7.2 WEBHOOK

Call an external URL:

```
webhook     → 'WEBHOOK' string_literal
```

Example:
```sel
WEBHOOK "https://api.example.com/alert"
```

#### 3.7.3 LOG (Reserved)

Log a message (reserved for future use):

```
log         → 'LOG' string_literal
```

#### 3.7.4 SET (Reserved)

Set a device parameter (reserved for future use):

```
set         → 'SET' target '=' value
```

### 3.8 Cooldown

Prevents repeated triggers:

```
cooldown    → 'COOLDOWN' duration
```

Example:
```sel
COOLDOWN 30min
```

## 4. Metrics

### 4.1 Built-in Metrics

| Metric | Type | Range | Description |
|--------|------|-------|-------------|
| `pv_power` | Power (W) | ≥ 0 | Solar PV power output |
| `battery_power` | Power (W) | any | Battery power (+charging, -discharging) |
| `battery_soc` | Percent | 0-100% | Battery state of charge |
| `grid_power` | Power (W) | any | Net grid power (+import, -export) |
| `grid_import` | Power (W) | ≥ 0 | Power imported from grid |
| `grid_export` | Power (W) | ≥ 0 | Power exported to grid |
| `load_power` | Power (W) | ≥ 0 | Total load consumption |

### 4.2 Metric Conventions

- Power values are in Watts
- Positive values indicate consumption/import/charging
- Negative values indicate generation/export/discharging
- State of charge is 0-100%

## 5. Operators

### 5.1 Comparison Operators

| Operator | Description |
|----------|-------------|
| `<` | Less than |
| `<=` | Less than or equal |
| `>` | Greater than |
| `>=` | Greater than or equal |
| `==` | Equal |
| `!=` | Not equal |

### 5.2 Logical Operators

| Operator | Description | Precedence |
|----------|-------------|------------|
| `NOT` | Logical negation | 1 (highest) |
| `AND` | Logical conjunction | 2 |
| `OR` | Logical disjunction | 3 (lowest) |

## 6. Units

### 6.1 Power Units

| Unit | Multiplier |
|------|------------|
| `W` | 1 |
| `kW` | 1,000 |
| `MW` | 1,000,000 |

### 6.2 Energy Units

| Unit | Multiplier |
|------|------------|
| `Wh` | 1 |
| `kWh` | 1,000 |
| `MWh` | 1,000,000 |

### 6.3 Duration Units

| Unit | Seconds |
|------|---------|
| `s` | 1 |
| `min` | 60 |
| `hour` | 3,600 |
| `day` | 86,400 |
| `week` | 604,800 |

## 7. Template Variables

Message templates support variable interpolation:

```sel
NOTIFY "Battery at {battery_soc}%, solar producing {pv_power}"
```

### 7.1 Supported Variables

Any metric name can be used as a template variable:
- `{pv_power}` - Current PV power
- `{battery_soc}` - Current battery state of charge
- `{grid_power}` - Current grid power
- etc.

### 7.2 Formatting

Values are formatted according to their type:
- Power: "3.5 kW" (auto-scaled)
- Percent: "85%"
- Energy: "15.2 kWh" (auto-scaled)

## 8. Compilation

### 8.1 Compilation Process

1. **Lexing** - Tokenize source code
2. **Parsing** - Build abstract syntax tree (AST)
3. **Validation** - Check semantic correctness
4. **Compilation** - Generate executable representation

### 8.2 Validation Rules

- All variable references must be defined
- Metrics must be valid metric names
- Time values must be valid (00:00 - 23:59)
- Percentages should be 0-100%
- Schedule rules must have valid frequency

### 8.3 JSON Output Format

Compiled programs produce JSON for runtime execution:

```json
{
  "version": "1.0",
  "compiled_at": "1703980800",
  "checksum": "sha256:...",
  "variables": [...],
  "rules": [...],
  "required_metrics": [...],
  "requires_history": true,
  "max_history_seconds": 604800
}
```

## 9. Runtime Semantics

### 9.1 Event Rule Evaluation

1. Receive new metric values
2. Evaluate condition with current values
3. If condition is true AND cooldown has expired:
   - Execute all actions in order
   - Start cooldown timer

### 9.2 Schedule Rule Evaluation

1. At scheduled time:
   - Execute all actions in order

### 9.3 Trend Evaluation

- **RISING** - Value has increased over the evaluation window
- **FALLING** - Value has decreased over the evaluation window
- **STABLE** - Value has not changed significantly

### 9.4 Anomaly Detection

Compare current value to historical average ± standard deviation. Value is "unusual" if it falls outside the normal range.

## 10. Error Handling

### 10.1 Compile-Time Errors

| Error | Description |
|-------|-------------|
| `SyntaxError` | Invalid syntax |
| `UnknownMetric` | Reference to undefined metric |
| `UndefinedVariable` | Reference to undefined variable |
| `DuplicateVariable` | Variable defined multiple times |
| `InvalidTime` | Invalid time format |
| `InvalidValue` | Value out of valid range |

### 10.2 Runtime Errors

| Error | Description |
|-------|-------------|
| `MetricUnavailable` | Metric data not available |
| `WebhookFailed` | Webhook request failed |
| `NotificationFailed` | Notification delivery failed |

## 11. Reserved Keywords

The following keywords are reserved and cannot be used as identifiers:

```
ON, EVERY, AT, DURING, BETWEEN, AND, OR, NOT,
NOTIFY, WEBHOOK, LOG, SET, COOLDOWN,
IS, UNUSUAL, COMPARED, TO,
RISING, FALLING, STABLE,
AVG, MEDIAN, SUM, MIN, MAX, COUNT, STDDEV, TREND, PERCENTILE,
day, daily, week, weekly, month, monthly,
monday, tuesday, wednesday, thursday, friday, saturday, sunday
```

## 12. Examples

### 12.1 Battery Monitoring

```sel
# Battery level monitoring with multiple thresholds
$critical = 10%
$low = 20%
$high = 90%

ON battery_soc < $critical
  NOTIFY "CRITICAL: Battery at {battery_soc}%!"
  COOLDOWN 5min

ON battery_soc < $low AND battery_soc >= $critical
  NOTIFY "Warning: Battery getting low"
  COOLDOWN 15min

ON battery_soc > $high AND pv_power < 1kW
  NOTIFY "Battery full, low solar - consider usage"
  COOLDOWN 1hour
```

### 12.2 Solar Production Monitoring

```sel
# Track solar production patterns
$high_production = 8kW
$low_production = 500W

ON pv_power > $high_production
  NOTIFY "Excellent solar: {pv_power}"
  COOLDOWN 2hour

ON pv_power IS UNUSUAL COMPARED TO 7day
  NOTIFY "Solar production anomaly detected"
  WEBHOOK "https://api.example.com/solar-alert"
  COOLDOWN 6hour

ON AVG(pv_power, 1hour) > 5kW
  NOTIFY "Sustained high production"
  COOLDOWN 1hour
```

### 12.3 Grid and Export Monitoring

```sel
# Monitor grid interaction
ON grid_export > 5kW AND battery_soc > 90%
  NOTIFY "High export with full battery: {grid_export}"
  COOLDOWN 30min

ON grid_import > 10kW
  NOTIFY "High grid usage warning: {grid_import}"
  COOLDOWN 15min
```

### 12.4 Scheduled Reports

```sel
# Daily and weekly reports
EVERY day AT 18:00
  NOTIFY "Daily energy summary ready"
  WEBHOOK "https://api.example.com/daily-report"

EVERY monday AT 09:00
  NOTIFY "Weekly energy report available"
  WEBHOOK "https://api.example.com/weekly-report"

EVERY saturday AT 10:00
  NOTIFY "Weekend energy check"
```

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-31 | Initial release |

## 14. Future Considerations

The following features are being considered for future versions:

- **v1.1**: Time ranges (`DURING 18:00-22:00`)
- **v1.2**: Device control actions (`SET battery_mode = "charge"`)
- **v1.3**: Conditional actions (`IF ... THEN ... ELSE`)
- **v2.0**: ML predictions (`PREDICT pv_power FOR tomorrow`)
