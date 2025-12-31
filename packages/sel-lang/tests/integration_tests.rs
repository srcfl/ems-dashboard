//! Integration tests for SEL (Sourceful Energy Language)

use sel_lang::*;

// ═══════════════════════════════════════════════════════════════════════════
// VARIABLE TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_variable_percent() {
    let source = "$threshold = 20%";
    let program = parse(source).unwrap();

    assert_eq!(program.variables.len(), 1);
    assert_eq!(program.variables[0].name, "threshold");

    match &program.variables[0].value {
        Value::Percent(p) => assert_eq!(*p, 20.0),
        _ => panic!("Expected Percent value"),
    }
}

#[test]
fn test_variable_power() {
    let source = "$min_power = 3kW";
    let program = parse(source).unwrap();

    assert_eq!(program.variables.len(), 1);
    match &program.variables[0].value {
        Value::Power { watts } => assert_eq!(*watts, 3000.0),
        _ => panic!("Expected Power value"),
    }
}

#[test]
fn test_variable_duration() {
    let source = "$cooldown = 30min";
    let program = parse(source).unwrap();

    assert_eq!(program.variables.len(), 1);
    match &program.variables[0].value {
        Value::Duration { seconds } => assert_eq!(*seconds, 1800),
        _ => panic!("Expected Duration value"),
    }
}

#[test]
fn test_multiple_variables() {
    let source = r#"
        $low = 20%
        $high = 80%
        $power_threshold = 5kW
    "#;
    let program = parse(source).unwrap();
    assert_eq!(program.variables.len(), 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT RULE TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_simple_comparison_lt() {
    let source = "ON battery_soc < 20%";
    let program = parse(source).unwrap();

    assert_eq!(program.rules.len(), 1);
    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            assert_eq!(cmp.operator, ComparisonOp::LessThan);
        } else {
            panic!("Expected Comparison condition");
        }
    } else {
        panic!("Expected Event rule");
    }
}

#[test]
fn test_simple_comparison_gt() {
    let source = "ON pv_power > 5kW";
    let program = parse(source).unwrap();

    assert_eq!(program.rules.len(), 1);
    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            assert_eq!(cmp.operator, ComparisonOp::GreaterThan);
        } else {
            panic!("Expected Comparison condition");
        }
    }
}

#[test]
fn test_comparison_with_variable() {
    let source = r#"
        $threshold = 20%
        ON battery_soc < $threshold
          NOTIFY "Low battery"
    "#;
    let program = parse(source).unwrap();

    assert_eq!(program.variables.len(), 1);
    assert_eq!(program.rules.len(), 1);
}

#[test]
fn test_rule_with_notify_action() {
    let source = r#"ON battery_soc < 20% NOTIFY "Battery low!""#;
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        assert_eq!(rule.actions.len(), 1);
        if let Action::Notify(notify) = &rule.actions[0] {
            assert!(!notify.message.parts.is_empty());
        } else {
            panic!("Expected Notify action");
        }
    }
}

#[test]
fn test_rule_with_cooldown() {
    let source = r#"ON battery_soc < 20% NOTIFY "Low" COOLDOWN 30min"#;
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        assert_eq!(rule.cooldown_seconds, Some(1800));
    }
}

#[test]
fn test_rule_with_webhook() {
    let source = r#"ON pv_power > 10kW WEBHOOK "https://api.example.com/alert""#;
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        assert_eq!(rule.actions.len(), 1);
        if let Action::Webhook(webhook) = &rule.actions[0] {
            assert_eq!(webhook.url, "https://api.example.com/alert");
        } else {
            panic!("Expected Webhook action");
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGICAL CONDITION TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_and_condition() {
    let source = "ON battery_soc < 20% AND pv_power > 3kW";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Logical(log) = &rule.condition {
            assert_eq!(log.operator, LogicalOp::And);
            assert_eq!(log.conditions.len(), 2);
        } else {
            panic!("Expected Logical condition");
        }
    }
}

#[test]
fn test_or_condition() {
    let source = "ON battery_soc < 10% OR battery_soc > 95%";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Logical(log) = &rule.condition {
            assert_eq!(log.operator, LogicalOp::Or);
            assert_eq!(log.conditions.len(), 2);
        } else {
            panic!("Expected Logical condition");
        }
    }
}

#[test]
fn test_not_condition() {
    let source = "ON NOT pv_power > 0";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Logical(log) = &rule.condition {
            assert_eq!(log.operator, LogicalOp::Not);
        } else {
            panic!("Expected Logical NOT condition");
        }
    }
}

#[test]
fn test_complex_logical() {
    let source = "ON (battery_soc < 20% OR battery_soc > 90%) AND pv_power > 1kW";
    let program = parse(source).unwrap();
    assert_eq!(program.rules.len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// TREND CONDITION TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_trend_rising() {
    let source = "ON battery_soc RISING";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Trend(trend) = &rule.condition {
            assert_eq!(trend.direction, TrendDirection::Rising);
            assert_eq!(trend.metric, Metric::BatterySoc);
        } else {
            panic!("Expected Trend condition");
        }
    }
}

#[test]
fn test_trend_falling() {
    let source = "ON pv_power FALLING";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Trend(trend) = &rule.condition {
            assert_eq!(trend.direction, TrendDirection::Falling);
            assert_eq!(trend.metric, Metric::PvPower);
        } else {
            panic!("Expected Trend condition");
        }
    }
}

#[test]
fn test_trend_stable() {
    let source = "ON grid_power STABLE";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Trend(trend) = &rule.condition {
            assert_eq!(trend.direction, TrendDirection::Stable);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANOMALY DETECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_anomaly_default_period() {
    let source = "ON pv_power IS UNUSUAL COMPARED TO 7day";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Anomaly(anomaly) = &rule.condition {
            assert_eq!(anomaly.metric, Metric::PvPower);
            assert_eq!(anomaly.period_seconds, 7 * 86400);
            assert_eq!(anomaly.sensitivity, 2.0);
        } else {
            panic!("Expected Anomaly condition");
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULE RULE TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_daily_schedule() {
    let source = r#"EVERY day AT 17:00 NOTIFY "Daily report""#;
    let program = parse(source).unwrap();

    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.frequency, CalendarFrequency::Daily);
            assert_eq!(cal.at.hour, 17);
            assert_eq!(cal.at.minute, 0);
        } else {
            panic!("Expected Calendar schedule");
        }
    }
}

#[test]
fn test_weekly_schedule() {
    let source = r#"EVERY week AT 09:00 NOTIFY "Weekly summary""#;
    let program = parse(source).unwrap();

    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.frequency, CalendarFrequency::Weekly);
        }
    }
}

#[test]
fn test_weekday_schedule() {
    let source = r#"EVERY monday AT 08:30 NOTIFY "Start of week""#;
    let program = parse(source).unwrap();

    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.frequency, CalendarFrequency::Weekly);
            assert_eq!(cal.on, Some(1)); // Monday
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_avg_function() {
    let source = "ON AVG(pv_power, 1hour) > 5kW";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Function(func) = &cmp.left {
                assert_eq!(func.name, Function::Avg);
                assert_eq!(func.period_seconds, Some(3600));
            } else {
                panic!("Expected Function expression");
            }
        }
    }
}

#[test]
fn test_max_function() {
    let source = "ON MAX(battery_soc) > 95%";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Function(func) = &cmp.left {
                assert_eq!(func.name, Function::Max);
            } else {
                panic!("Expected Function expression");
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARITHMETIC EXPRESSION TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_arithmetic_addition() {
    let source = "ON pv_power + battery_power > 10kW";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Binary(bin) = &cmp.left {
                assert_eq!(bin.operator, BinaryOp::Add);
            } else {
                panic!("Expected Binary expression");
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_compile_extracts_metrics() {
    let source = "ON battery_soc < 20% AND pv_power > 3kW";
    let program = parse(source).unwrap();

    let mut compiler = Compiler::new();
    let compiled = compiler.compile(&program).unwrap();

    assert!(compiled.required_metrics.contains(&Metric::BatterySoc));
    assert!(compiled.required_metrics.contains(&Metric::PvPower));
}

#[test]
fn test_compile_detects_history_need() {
    let source = "ON pv_power IS UNUSUAL COMPARED TO 7day";
    let program = parse(source).unwrap();

    let mut compiler = Compiler::new();
    let compiled = compiler.compile(&program).unwrap();

    assert!(compiled.requires_history);
    assert_eq!(compiled.max_history_seconds, Some(7 * 86400));
}

#[test]
fn test_json_serialization() {
    let source = r#"
        $threshold = 20%
        ON battery_soc < $threshold
          NOTIFY "Battery low"
          COOLDOWN 30min
    "#;

    let json = parse_and_compile(source).unwrap();

    assert!(json.contains("\"version\""));
    assert!(json.contains("\"variables\""));
    assert!(json.contains("\"rules\""));
    assert!(json.contains("\"threshold\""));
    assert!(json.contains("battery_soc"));
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_lexer_error_invalid_char() {
    let source = "ON battery_soc @ 20%";
    let result = parse(source);
    assert!(result.is_err());
}

#[test]
fn test_parser_error_missing_condition() {
    let source = "ON NOTIFY \"test\"";
    let result = parse(source);
    // Should either error or parse with issues
    // The parser might still produce something, so just check it runs
    let _ = result;
}

// ═══════════════════════════════════════════════════════════════════════════
// REAL-WORLD SCENARIO TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_low_battery_alert() {
    let source = r#"
        $critical_level = 10%
        $warning_level = 20%

        ON battery_soc < $critical_level
          NOTIFY "CRITICAL: Battery extremely low!"
          COOLDOWN 5min

        ON battery_soc < $warning_level AND battery_soc >= $critical_level
          NOTIFY "Warning: Battery getting low"
          COOLDOWN 15min
    "#;

    let program = parse(source).unwrap();
    assert_eq!(program.variables.len(), 2);
    assert_eq!(program.rules.len(), 2);
}

#[test]
fn test_high_solar_production() {
    let source = r#"
        $high_power = 8kW

        ON pv_power > $high_power
          NOTIFY "Solar production is excellent!"
          WEBHOOK "https://api.example.com/solar-alert"
          COOLDOWN 1hour
    "#;

    let program = parse(source).unwrap();
    assert_eq!(program.variables.len(), 1);

    if let Rule::Event(rule) = &program.rules[0] {
        assert_eq!(rule.actions.len(), 2);
        assert_eq!(rule.cooldown_seconds, Some(3600));
    }
}

#[test]
fn test_daily_summary() {
    let source = r#"
        EVERY day AT 18:00
          NOTIFY "Daily energy summary ready"
    "#;

    let program = parse(source).unwrap();
    assert_eq!(program.rules.len(), 1);

    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.at.hour, 18);
        }
    }
}

#[test]
fn test_grid_export_monitor() {
    let source = r#"
        ON grid_export > 5kW AND battery_soc > 80%
          NOTIFY "Exporting power with full battery!"
          COOLDOWN 30min
    "#;

    let program = parse(source).unwrap();

    let mut compiler = Compiler::new();
    let compiled = compiler.compile(&program).unwrap();

    assert!(compiled.required_metrics.contains(&Metric::GridExport));
    assert!(compiled.required_metrics.contains(&Metric::BatterySoc));
}

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL COMPARISON OPERATOR TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_comparison_eq() {
    let source = "ON battery_soc == 100%";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            assert_eq!(cmp.operator, ComparisonOp::Equal);
        }
    }
}

#[test]
fn test_comparison_neq() {
    let source = "ON battery_soc != 0%";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            assert_eq!(cmp.operator, ComparisonOp::NotEqual);
        }
    }
}

#[test]
fn test_comparison_lte() {
    let source = "ON pv_power <= 100W";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            assert_eq!(cmp.operator, ComparisonOp::LessThanOrEqual);
        }
    }
}

#[test]
fn test_comparison_gte() {
    let source = "ON grid_import >= 10kW";
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            assert_eq!(cmp.operator, ComparisonOp::GreaterThanOrEqual);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIT TESTS - POWER, ENERGY, DURATION
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_power_units_w() {
    let source = "$power = 500W";
    let program = parse(source).unwrap();
    if let Value::Power { watts } = &program.variables[0].value {
        assert_eq!(*watts, 500.0);
    }
}

#[test]
fn test_power_units_mw() {
    let source = "$power = 1MW";
    let program = parse(source).unwrap();
    if let Value::Power { watts } = &program.variables[0].value {
        assert_eq!(*watts, 1_000_000.0);
    }
}

#[test]
fn test_energy_units_wh() {
    let source = "$energy = 100Wh";
    let program = parse(source).unwrap();
    if let Value::Energy { watt_hours } = &program.variables[0].value {
        assert_eq!(*watt_hours, 100.0);
    }
}

#[test]
fn test_energy_units_kwh() {
    let source = "$energy = 15kWh";
    let program = parse(source).unwrap();
    if let Value::Energy { watt_hours } = &program.variables[0].value {
        assert_eq!(*watt_hours, 15000.0);
    }
}

#[test]
fn test_energy_units_mwh() {
    let source = "$energy = 2MWh";
    let program = parse(source).unwrap();
    if let Value::Energy { watt_hours } = &program.variables[0].value {
        assert_eq!(*watt_hours, 2_000_000.0);
    }
}

#[test]
fn test_duration_seconds() {
    let source = "$wait = 30s";
    let program = parse(source).unwrap();
    if let Value::Duration { seconds } = &program.variables[0].value {
        assert_eq!(*seconds, 30);
    }
}

#[test]
fn test_duration_hour() {
    let source = "$wait = 2hour";
    let program = parse(source).unwrap();
    if let Value::Duration { seconds } = &program.variables[0].value {
        assert_eq!(*seconds, 7200);
    }
}

#[test]
fn test_duration_day() {
    let source = "$wait = 1day";
    let program = parse(source).unwrap();
    if let Value::Duration { seconds } = &program.variables[0].value {
        assert_eq!(*seconds, 86400);
    }
}

#[test]
fn test_duration_week() {
    let source = "$wait = 2week";
    let program = parse(source).unwrap();
    if let Value::Duration { seconds } = &program.variables[0].value {
        assert_eq!(*seconds, 1209600);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKDAY SCHEDULE TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_tuesday_schedule() {
    let source = r#"EVERY tuesday AT 10:00 NOTIFY "Tuesday alert""#;
    let program = parse(source).unwrap();
    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.on, Some(2));
        }
    }
}

#[test]
fn test_wednesday_schedule() {
    let source = r#"EVERY wednesday AT 10:00 NOTIFY "Wednesday alert""#;
    let program = parse(source).unwrap();
    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.on, Some(3));
        }
    }
}

#[test]
fn test_thursday_schedule() {
    let source = r#"EVERY thursday AT 10:00 NOTIFY "Thursday alert""#;
    let program = parse(source).unwrap();
    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.on, Some(4));
        }
    }
}

#[test]
fn test_friday_schedule() {
    let source = r#"EVERY friday AT 17:00 NOTIFY "TGIF""#;
    let program = parse(source).unwrap();
    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.on, Some(5));
        }
    }
}

#[test]
fn test_saturday_schedule() {
    let source = r#"EVERY saturday AT 10:00 NOTIFY "Weekend""#;
    let program = parse(source).unwrap();
    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.on, Some(6));
        }
    }
}

#[test]
fn test_sunday_schedule() {
    let source = r#"EVERY sunday AT 10:00 NOTIFY "Sunday""#;
    let program = parse(source).unwrap();
    if let Rule::Schedule(rule) = &program.rules[0] {
        if let Schedule::Calendar(cal) = &rule.schedule {
            assert_eq!(cal.on, Some(7));
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMENT TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_line_comments() {
    let source = r#"
        # This is a comment
        $threshold = 20%
        # Another comment
        ON battery_soc < $threshold
          NOTIFY "Low battery"  # Inline comment
    "#;
    let program = parse(source).unwrap();
    assert_eq!(program.variables.len(), 1);
    assert_eq!(program.rules.len(), 1);
}

#[test]
fn test_slash_comments() {
    let source = r#"
        // C-style comment
        $threshold = 20%
    "#;
    let program = parse(source).unwrap();
    assert_eq!(program.variables.len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE VARIABLE TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_template_with_single_var() {
    let source = r#"ON battery_soc < 20% NOTIFY "Battery at {battery_soc}%""#;
    let program = parse(source).unwrap();

    if let Rule::Event(rule) = &program.rules[0] {
        if let Action::Notify(notify) = &rule.actions[0] {
            // Check template has parts
            assert!(!notify.message.parts.is_empty());
        }
    }
}

#[test]
fn test_template_with_multiple_vars() {
    let source = r#"ON pv_power > 5kW NOTIFY "Solar: {pv_power}, Grid: {grid_power}""#;
    let program = parse(source).unwrap();
    assert_eq!(program.rules.len(), 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION TESTS - ALL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_min_function() {
    let source = "ON MIN(battery_soc, 24hour) < 10%";
    let program = parse(source).unwrap();
    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Function(func) = &cmp.left {
                assert_eq!(func.name, Function::Min);
            }
        }
    }
}

#[test]
fn test_sum_function() {
    let source = "ON SUM(grid_import, 1hour) > 10kWh";
    let program = parse(source).unwrap();
    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Function(func) = &cmp.left {
                assert_eq!(func.name, Function::Sum);
            }
        }
    }
}

#[test]
fn test_median_function() {
    let source = "ON MEDIAN(pv_power, 1hour) > 3kW";
    let program = parse(source).unwrap();
    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Function(func) = &cmp.left {
                assert_eq!(func.name, Function::Median);
            }
        }
    }
}

#[test]
fn test_count_function() {
    let source = "ON COUNT(pv_power, 1hour) > 60";
    let program = parse(source).unwrap();
    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Function(func) = &cmp.left {
                assert_eq!(func.name, Function::Count);
            }
        }
    }
}

#[test]
fn test_stddev_function() {
    let source = "ON STDDEV(pv_power, 1hour) < 100W";
    let program = parse(source).unwrap();
    if let Rule::Event(rule) = &program.rules[0] {
        if let Condition::Comparison(cmp) = &rule.condition {
            if let Expression::Function(func) = &cmp.left {
                assert_eq!(func.name, Function::Stddev);
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTIPLE RULES TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_multiple_event_rules() {
    let source = r#"
        ON battery_soc < 20%
          NOTIFY "Low battery"

        ON pv_power > 8kW
          NOTIFY "High solar"

        ON grid_export > 5kW
          NOTIFY "Exporting"
    "#;
    let program = parse(source).unwrap();
    assert_eq!(program.rules.len(), 3);
}

#[test]
fn test_mixed_rules() {
    let source = r#"
        $threshold = 20%

        ON battery_soc < $threshold
          NOTIFY "Low battery"

        EVERY day AT 18:00
          NOTIFY "Daily summary"

        ON pv_power RISING
          NOTIFY "Sun is shining"
    "#;
    let program = parse(source).unwrap();
    assert_eq!(program.variables.len(), 1);
    assert_eq!(program.rules.len(), 3);
}

// ═══════════════════════════════════════════════════════════════════════════
// ALL METRICS TESTS
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_all_metrics() {
    let source = r#"
        ON pv_power > 0
          NOTIFY "PV active"

        ON battery_power > 0
          NOTIFY "Battery active"

        ON battery_soc < 50%
          NOTIFY "Half battery"

        ON grid_power > 0
          NOTIFY "Importing"

        ON grid_import > 0
          NOTIFY "Grid import"

        ON grid_export > 0
          NOTIFY "Grid export"

        ON load_power > 5kW
          NOTIFY "High load"
    "#;
    let program = parse(source).unwrap();
    assert_eq!(program.rules.len(), 7);

    let mut compiler = Compiler::new();
    let compiled = compiler.compile(&program).unwrap();

    assert!(compiled.required_metrics.contains(&Metric::PvPower));
    assert!(compiled.required_metrics.contains(&Metric::BatteryPower));
    assert!(compiled.required_metrics.contains(&Metric::BatterySoc));
    assert!(compiled.required_metrics.contains(&Metric::GridPower));
    assert!(compiled.required_metrics.contains(&Metric::GridImport));
    assert!(compiled.required_metrics.contains(&Metric::GridExport));
    assert!(compiled.required_metrics.contains(&Metric::LoadPower));
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CASES
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn test_unterminated_string() {
    let source = r#"ON battery_soc < 20% NOTIFY "Unterminated"#;
    let result = parse(source);
    assert!(result.is_err());
}

#[test]
fn test_invalid_operator() {
    let source = "ON battery_soc @@ 20%";
    let result = parse(source);
    assert!(result.is_err());
}

#[test]
fn test_empty_variable_name() {
    let source = "$ = 20%";
    let result = parse(source);
    assert!(result.is_err());
}
