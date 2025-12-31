//! WASM bindings for SEL
//!
//! This module provides JavaScript-friendly bindings for using SEL in the browser.

use wasm_bindgen::prelude::*;
use crate::{parse, parse_and_compile, Lexer};

/// Parse SEL source code and return JSON AST
#[wasm_bindgen]
pub fn sel_parse(source: &str) -> Result<String, JsValue> {
    let program = parse(source)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    serde_json::to_string_pretty(&program)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Parse and compile SEL source code to JSON
#[wasm_bindgen]
pub fn sel_compile(source: &str) -> Result<String, JsValue> {
    parse_and_compile(source)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Validate SEL source code without compiling
/// Returns empty string if valid, error message if invalid
#[wasm_bindgen]
pub fn sel_validate(source: &str) -> String {
    match parse(source) {
        Ok(_) => String::new(),
        Err(e) => e.to_string(),
    }
}

/// Tokenize SEL source code for syntax highlighting
/// Returns JSON array of tokens with positions
#[wasm_bindgen]
pub fn sel_tokenize(source: &str) -> Result<String, JsValue> {
    let lexer = Lexer::new(source);
    let tokens = lexer.tokenize()
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Convert to simple JSON-friendly format
    let token_data: Vec<TokenData> = tokens.iter().map(|t| TokenData {
        kind: format!("{:?}", t.kind),
        value: t.value.clone(),
        line: t.location.line,
        column: t.location.column,
    }).collect();

    serde_json::to_string(&token_data)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Get list of available metrics
#[wasm_bindgen]
pub fn sel_get_metrics() -> String {
    r#"["pv_power","battery_power","battery_soc","grid_power","grid_import","grid_export","load_power"]"#.to_string()
}

/// Get list of available functions
#[wasm_bindgen]
pub fn sel_get_functions() -> String {
    r#"["AVG","MEDIAN","SUM","MIN","MAX","COUNT","STDDEV","TREND","PERCENTILE"]"#.to_string()
}

/// Get list of keywords for syntax highlighting
#[wasm_bindgen]
pub fn sel_get_keywords() -> String {
    r#"["ON","EVERY","AT","DURING","BETWEEN","AND","OR","NOT","NOTIFY","WEBHOOK","LOG","SET","COOLDOWN","IS","UNUSUAL","COMPARED","TO","RISING","FALLING","STABLE"]"#.to_string()
}

/// Get SEL version
#[wasm_bindgen]
pub fn sel_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[derive(serde::Serialize)]
struct TokenData {
    kind: String,
    value: String,
    line: usize,
    column: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_parse() {
        let result = sel_parse("ON battery_soc < 20%");
        assert!(result.is_ok());
    }

    #[test]
    fn test_wasm_compile() {
        let result = sel_compile("ON battery_soc < 20%");
        assert!(result.is_ok());
    }

    #[test]
    fn test_wasm_validate_valid() {
        let result = sel_validate("ON battery_soc < 20%");
        assert!(result.is_empty());
    }

    #[test]
    fn test_wasm_validate_invalid() {
        let result = sel_validate("ON battery_soc @@ 20%");
        assert!(!result.is_empty());
    }

    #[test]
    fn test_wasm_tokenize() {
        let result = sel_tokenize("ON battery_soc < 20%");
        assert!(result.is_ok());
    }
}
