//! SEL Scheduler
//!
//! Handles time-based rule evaluation (EVERY day AT, EVERY monday AT, etc.)

use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::ast::*;

/// State for schedule tracking
#[derive(Debug, Clone)]
pub struct ScheduleState {
    /// Last trigger time for each rule
    last_triggered: HashMap<String, Instant>,
    /// Last trigger timestamp (for persistence)
    last_triggered_ts: HashMap<String, u64>,
}

impl ScheduleState {
    pub fn new() -> Self {
        Self {
            last_triggered: HashMap::new(),
            last_triggered_ts: HashMap::new(),
        }
    }

    /// Record that a rule was triggered
    pub fn record_trigger(&mut self, rule_id: &str, timestamp: u64) {
        self.last_triggered.insert(rule_id.to_string(), Instant::now());
        self.last_triggered_ts.insert(rule_id.to_string(), timestamp);
    }

    /// Get last trigger timestamp for a rule
    pub fn last_trigger_ts(&self, rule_id: &str) -> Option<u64> {
        self.last_triggered_ts.get(rule_id).copied()
    }

    /// Check if enough time has passed since last trigger
    pub fn can_trigger(&self, rule_id: &str, min_interval: Duration) -> bool {
        if let Some(last) = self.last_triggered.get(rule_id) {
            last.elapsed() >= min_interval
        } else {
            true
        }
    }
}

impl Default for ScheduleState {
    fn default() -> Self {
        Self::new()
    }
}

/// Datetime components for schedule evaluation
#[derive(Debug, Clone, Copy)]
pub struct DateTime {
    pub year: u16,
    pub month: u8,      // 1-12
    pub day: u8,        // 1-31
    pub weekday: u8,    // 1-7 (Monday = 1)
    pub hour: u8,       // 0-23
    pub minute: u8,     // 0-59
    pub second: u8,     // 0-59
    pub timestamp: u64, // Unix timestamp in seconds
}

impl DateTime {
    /// Create from Unix timestamp
    pub fn from_timestamp(ts: u64) -> Self {
        // Simple implementation - for production use chrono crate
        let days_since_epoch = ts / 86400;
        let time_of_day = ts % 86400;

        let hour = (time_of_day / 3600) as u8;
        let minute = ((time_of_day % 3600) / 60) as u8;
        let second = (time_of_day % 60) as u8;

        // Calculate weekday (1970-01-01 was Thursday = 4)
        let weekday = ((days_since_epoch + 3) % 7 + 1) as u8;

        // Simplified year/month/day calculation
        let (year, month, day) = days_to_ymd(days_since_epoch as i64);

        Self {
            year: year as u16,
            month: month as u8,
            day: day as u8,
            weekday,
            hour,
            minute,
            second,
            timestamp: ts,
        }
    }

    /// Get current datetime
    pub fn now() -> Self {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        Self::from_timestamp(ts)
    }
}

/// Convert days since epoch to year, month, day
fn days_to_ymd(days: i64) -> (i32, i32, i32) {
    // Simplified Gregorian calendar calculation
    let mut remaining = days;
    let mut year = 1970i32;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        year += 1;
    }

    let mut month = 1i32;
    let days_in_months = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    for &dim in &days_in_months {
        if remaining < dim {
            break;
        }
        remaining -= dim;
        month += 1;
    }

    (year, month, (remaining + 1) as i32)
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// The scheduler for evaluating time-based rules
#[derive(Clone)]
pub struct Scheduler {
    state: ScheduleState,
}

impl Scheduler {
    pub fn new() -> Self {
        Self {
            state: ScheduleState::new(),
        }
    }

    /// Create with existing state (for persistence)
    pub fn with_state(state: ScheduleState) -> Self {
        Self { state }
    }

    /// Get current state (for persistence)
    pub fn state(&self) -> &ScheduleState {
        &self.state
    }

    /// Check if a schedule rule should trigger at the given time
    pub fn should_trigger(&self, rule: &ScheduleRule, now: &DateTime) -> bool {
        if !rule.enabled {
            return false;
        }

        // Check minimum interval (1 minute) to prevent double-triggers
        if !self.state.can_trigger(&rule.id, Duration::from_secs(60)) {
            return false;
        }

        // Check if we already triggered today/this hour
        if let Some(last_ts) = self.state.last_trigger_ts(&rule.id) {
            let last = DateTime::from_timestamp(last_ts);
            if self.already_triggered_in_period(rule, &last, now) {
                return false;
            }
        }

        self.matches_schedule(&rule.schedule, now)
    }

    /// Check if the current time matches the schedule
    fn matches_schedule(&self, schedule: &Schedule, now: &DateTime) -> bool {
        match schedule {
            Schedule::Calendar(cal) => self.matches_calendar(cal, now),
            Schedule::Interval(_) => {
                // Interval schedules are handled differently
                // They trigger based on elapsed time, not clock time
                false // Return false here; use check_interval instead
            }
            Schedule::Cron(_) => {
                // Cron expressions not implemented in v1.0
                false
            }
        }
    }

    fn matches_calendar(&self, cal: &CalendarSchedule, now: &DateTime) -> bool {
        // Check if the time matches
        if now.hour != cal.at.hour || now.minute != cal.at.minute {
            return false;
        }

        // Only trigger in the first 60 seconds of the matching minute
        if now.second >= 60 {
            return false;
        }

        match cal.frequency {
            CalendarFrequency::Daily => true,
            CalendarFrequency::Weekly => {
                if let Some(target_day) = cal.on {
                    now.weekday == target_day
                } else {
                    // If no specific day, trigger on Monday
                    now.weekday == 1
                }
            }
            CalendarFrequency::Monthly => {
                if let Some(target_day) = cal.on {
                    now.day == target_day
                } else {
                    // If no specific day, trigger on 1st
                    now.day == 1
                }
            }
            CalendarFrequency::Yearly => {
                if let Some(target_day) = cal.on {
                    now.day == target_day && now.month == 1
                } else {
                    now.day == 1 && now.month == 1
                }
            }
        }
    }

    fn already_triggered_in_period(&self, rule: &ScheduleRule, last: &DateTime, now: &DateTime) -> bool {
        match &rule.schedule {
            Schedule::Calendar(cal) => match cal.frequency {
                CalendarFrequency::Daily => {
                    last.year == now.year && last.month == now.month && last.day == now.day
                }
                CalendarFrequency::Weekly => {
                    // Same week (simplified: same day)
                    last.year == now.year && last.month == now.month && last.day == now.day
                }
                CalendarFrequency::Monthly => {
                    last.year == now.year && last.month == now.month
                }
                CalendarFrequency::Yearly => {
                    last.year == now.year
                }
            },
            Schedule::Interval(_) => false,
            Schedule::Cron(_) => false,
        }
    }

    /// Check interval-based schedule
    pub fn check_interval(&self, rule: &ScheduleRule, now_ts: u64) -> bool {
        if !rule.enabled {
            return false;
        }

        if let Schedule::Interval(interval) = &rule.schedule {
            if let Some(last_ts) = self.state.last_trigger_ts(&rule.id) {
                now_ts >= last_ts + interval.interval_seconds
            } else {
                true // Never triggered before
            }
        } else {
            false
        }
    }

    /// Record that a rule was triggered
    pub fn record_trigger(&mut self, rule_id: &str, timestamp: u64) {
        self.state.record_trigger(rule_id, timestamp);
    }

    /// Calculate next trigger time for a schedule rule
    pub fn next_trigger(&self, rule: &ScheduleRule, now: &DateTime) -> Option<u64> {
        if !rule.enabled {
            return None;
        }

        match &rule.schedule {
            Schedule::Calendar(cal) => self.next_calendar_trigger(cal, now),
            Schedule::Interval(interval) => {
                if let Some(last) = self.state.last_trigger_ts(&rule.id) {
                    Some(last + interval.interval_seconds)
                } else {
                    Some(now.timestamp)
                }
            }
            Schedule::Cron(_) => None, // Not implemented
        }
    }

    fn next_calendar_trigger(&self, cal: &CalendarSchedule, now: &DateTime) -> Option<u64> {
        let target_hour = cal.at.hour;
        let target_minute = cal.at.minute;

        // Start from today
        let mut next_ts = now.timestamp;
        let mut check = DateTime::from_timestamp(next_ts);

        // If we've already passed the target time today, move to tomorrow
        if check.hour > target_hour || (check.hour == target_hour && check.minute >= target_minute) {
            next_ts += 86400; // Add one day
            check = DateTime::from_timestamp(next_ts);
        }

        // Set to target time
        let time_diff = (target_hour as i64 - check.hour as i64) * 3600
            + (target_minute as i64 - check.minute as i64) * 60
            - check.second as i64;
        next_ts = (next_ts as i64 + time_diff) as u64;
        check = DateTime::from_timestamp(next_ts);

        // Find the next matching day
        for _ in 0..366 {
            if self.matches_calendar(cal, &check) || self.day_matches_frequency(cal, &check) {
                return Some(next_ts);
            }
            next_ts += 86400;
            check = DateTime::from_timestamp(next_ts);
        }

        None
    }

    fn day_matches_frequency(&self, cal: &CalendarSchedule, dt: &DateTime) -> bool {
        match cal.frequency {
            CalendarFrequency::Daily => true,
            CalendarFrequency::Weekly => {
                if let Some(target_day) = cal.on {
                    dt.weekday == target_day
                } else {
                    dt.weekday == 1
                }
            }
            CalendarFrequency::Monthly => {
                if let Some(target_day) = cal.on {
                    dt.day == target_day
                } else {
                    dt.day == 1
                }
            }
            CalendarFrequency::Yearly => {
                if let Some(target_day) = cal.on {
                    dt.day == target_day && dt.month == 1
                } else {
                    dt.day == 1 && dt.month == 1
                }
            }
        }
    }
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_datetime_from_timestamp() {
        // 2024-01-15 10:30:00 UTC
        let ts = 1705314600;
        let dt = DateTime::from_timestamp(ts);

        assert_eq!(dt.hour, 10);
        assert_eq!(dt.minute, 30);
        assert_eq!(dt.weekday, 1); // Monday
    }

    #[test]
    fn test_daily_schedule() {
        let scheduler = Scheduler::new();

        let rule = ScheduleRule {
            id: "test".to_string(),
            name: None,
            schedule: Schedule::Calendar(CalendarSchedule {
                frequency: CalendarFrequency::Daily,
                at: TimeOfDay { hour: 18, minute: 0 },
                on: None,
            }),
            actions: vec![],
            enabled: true,
        };

        // At 18:00
        let dt = DateTime {
            year: 2024,
            month: 1,
            day: 15,
            weekday: 1,
            hour: 18,
            minute: 0,
            second: 0,
            timestamp: 1705341600,
        };
        assert!(scheduler.should_trigger(&rule, &dt));

        // At 17:59
        let dt2 = DateTime {
            year: 2024,
            month: 1,
            day: 15,
            weekday: 1,
            hour: 17,
            minute: 59,
            second: 0,
            timestamp: 1705341540,
        };
        assert!(!scheduler.should_trigger(&rule, &dt2));
    }

    #[test]
    fn test_weekly_schedule() {
        let scheduler = Scheduler::new();

        let rule = ScheduleRule {
            id: "test".to_string(),
            name: None,
            schedule: Schedule::Calendar(CalendarSchedule {
                frequency: CalendarFrequency::Weekly,
                at: TimeOfDay { hour: 9, minute: 0 },
                on: Some(1), // Monday
            }),
            actions: vec![],
            enabled: true,
        };

        // Monday at 09:00
        let monday = DateTime {
            year: 2024,
            month: 1,
            day: 15,
            weekday: 1,
            hour: 9,
            minute: 0,
            second: 0,
            timestamp: 1705309200,
        };
        assert!(scheduler.should_trigger(&rule, &monday));

        // Tuesday at 09:00
        let tuesday = DateTime {
            year: 2024,
            month: 1,
            day: 16,
            weekday: 2,
            hour: 9,
            minute: 0,
            second: 0,
            timestamp: 1705395600,
        };
        assert!(!scheduler.should_trigger(&rule, &tuesday));
    }

    #[test]
    fn test_disabled_rule() {
        let scheduler = Scheduler::new();

        let rule = ScheduleRule {
            id: "test".to_string(),
            name: None,
            schedule: Schedule::Calendar(CalendarSchedule {
                frequency: CalendarFrequency::Daily,
                at: TimeOfDay { hour: 18, minute: 0 },
                on: None,
            }),
            actions: vec![],
            enabled: false,
        };

        let dt = DateTime {
            year: 2024,
            month: 1,
            day: 15,
            weekday: 1,
            hour: 18,
            minute: 0,
            second: 0,
            timestamp: 1705341600,
        };
        assert!(!scheduler.should_trigger(&rule, &dt));
    }

    #[test]
    fn test_record_trigger_prevents_double() {
        let mut scheduler = Scheduler::new();

        let rule = ScheduleRule {
            id: "test".to_string(),
            name: None,
            schedule: Schedule::Calendar(CalendarSchedule {
                frequency: CalendarFrequency::Daily,
                at: TimeOfDay { hour: 18, minute: 0 },
                on: None,
            }),
            actions: vec![],
            enabled: true,
        };

        let dt = DateTime {
            year: 2024,
            month: 1,
            day: 15,
            weekday: 1,
            hour: 18,
            minute: 0,
            second: 0,
            timestamp: 1705341600,
        };

        // First check - should trigger
        assert!(scheduler.should_trigger(&rule, &dt));

        // Record the trigger
        scheduler.record_trigger("test", dt.timestamp);

        // Second check - should not trigger (same minute)
        assert!(!scheduler.should_trigger(&rule, &dt));
    }
}
