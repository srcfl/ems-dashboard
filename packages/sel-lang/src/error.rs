//! Error types for SEL

use thiserror::Error;
use serde::{Serialize, Deserialize};

/// Main error type for SEL
#[derive(Debug, Error)]
pub enum SELError {
    #[error("Lexer error at line {line}, column {column}: {message}")]
    LexerError {
        message: String,
        line: usize,
        column: usize,
    },

    #[error("Parser error at line {line}, column {column}: {message}")]
    ParserError {
        message: String,
        line: usize,
        column: usize,
    },

    #[error("Compiler error: {0}")]
    CompilerError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Runtime error: {0}")]
    RuntimeError(String),
}

impl SELError {
    pub fn lexer(message: impl Into<String>, line: usize, column: usize) -> Self {
        SELError::LexerError {
            message: message.into(),
            line,
            column,
        }
    }

    pub fn parser(message: impl Into<String>, line: usize, column: usize) -> Self {
        SELError::ParserError {
            message: message.into(),
            line,
            column,
        }
    }

    pub fn compiler(message: impl Into<String>) -> Self {
        SELError::CompilerError(message.into())
    }

    pub fn runtime(message: impl Into<String>) -> Self {
        SELError::RuntimeError(message.into())
    }
}

/// Location in source code
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceLocation {
    pub line: usize,
    pub column: usize,
    pub offset: usize,
}

impl SourceLocation {
    pub fn new(line: usize, column: usize, offset: usize) -> Self {
        Self { line, column, offset }
    }
}

impl Default for SourceLocation {
    fn default() -> Self {
        Self { line: 1, column: 1, offset: 0 }
    }
}
