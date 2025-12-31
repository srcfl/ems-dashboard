//! # Sourceful Energy Language (SEL)
//!
//! A domain-specific language for energy automation rules.
//!
//! ## Example
//!
//! ```rust
//! use sel_lang::*;
//!
//! let source = r#"
//!     $low_battery = 20%
//!
//!     ON battery_soc < $low_battery
//!       NOTIFY "Battery low: {battery_soc}"
//!       COOLDOWN 30min
//! "#;
//!
//! let program = parse(source).unwrap();
//! let json = compile_to_json(&program).unwrap();
//! ```

pub mod ast;
pub mod error;
pub mod lexer;
pub mod parser;
pub mod compiler;
pub mod runtime;
pub mod scheduler;
pub mod dispatcher;

#[cfg(feature = "wasm")]
pub mod wasm;

pub use ast::*;
pub use error::*;
pub use lexer::Lexer;
pub use parser::Parser;
pub use compiler::Compiler;
pub use runtime::{Runtime, MetricValues, MetricHistory, CooldownState, RuleResult, ActionResult};
pub use scheduler::{Scheduler, ScheduleState, DateTime};
pub use dispatcher::{
    Dispatcher, DispatcherBuilder, DispatcherConfig, DispatchResult,
    WebhookConfig, WebhookAuthType, WebhookEvent, WebhookDelivery,
};

#[cfg(feature = "server")]
pub use dispatcher::async_dispatcher::{AsyncDispatcher, test_webhook};

/// Parse SEL source code into an AST
pub fn parse(source: &str) -> Result<Program, SELError> {
    let lexer = Lexer::new(source);
    let tokens = lexer.tokenize()?;
    let parser = Parser::new(tokens);
    parser.parse()
}

/// Compile a program to JSON
pub fn compile_to_json(program: &Program) -> Result<String, SELError> {
    let compiler = Compiler::new();
    compiler.to_json(program)
}

/// Parse and compile in one step
pub fn parse_and_compile(source: &str) -> Result<String, SELError> {
    let program = parse(source)?;
    compile_to_json(&program)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_rule() {
        let source = r#"
            ON battery_soc < 20%
              NOTIFY "Battery low"
        "#;

        let result = parse(source);
        assert!(result.is_ok(), "Parse failed: {:?}", result.err());

        let program = result.unwrap();
        assert_eq!(program.rules.len(), 1);
    }

    #[test]
    fn test_variable_declaration() {
        let source = r#"
            $threshold = 20%
            ON battery_soc < $threshold
              NOTIFY "Low"
        "#;

        let result = parse(source);
        assert!(result.is_ok(), "Parse failed: {:?}", result.err());

        let program = result.unwrap();
        assert_eq!(program.variables.len(), 1);
        assert_eq!(program.variables[0].name, "threshold");
    }

    #[test]
    fn test_scheduled_rule() {
        let source = r#"
            EVERY day AT 17:00
              NOTIFY "Daily report"
        "#;

        let result = parse(source);
        assert!(result.is_ok(), "Parse failed: {:?}", result.err());
    }

    #[test]
    fn test_compile_to_json() {
        let source = r#"
            ON pv_power > 3kW
              NOTIFY "High solar"
        "#;

        let result = parse_and_compile(source);
        assert!(result.is_ok(), "Compile failed: {:?}", result.err());

        let json = result.unwrap();
        assert!(json.contains("\"version\""));
        assert!(json.contains("\"rules\""));
    }
}
