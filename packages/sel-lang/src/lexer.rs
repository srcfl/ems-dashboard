//! SEL Lexer - Tokenizes source code

use crate::error::{SELError, SourceLocation};

#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub value: String,
    pub location: SourceLocation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TokenKind {
    // Keywords
    On, Every, At, During, Between, And, Or, Not,
    Notify, Webhook, Log, Set, Cooldown,
    Is, Unusual, Compared, To,
    Rising, Falling, Stable,

    // Literals
    Number,
    Percent,
    String,
    Time,
    Duration,

    // Identifiers
    Metric,
    Function,
    Variable,
    Identifier,

    // Operators
    Plus, Minus, Star, Slash, Modulo,
    Eq, Neq, Lt, Lte, Gt, Gte,
    Assign,

    // Punctuation
    LParen, RParen, LBrace, RBrace,
    Comma, Dot, DotDot, Colon,

    // Whitespace
    Newline, Indent, Dedent,

    // End
    Eof,
}

pub struct Lexer<'a> {
    source: &'a str,
    chars: std::iter::Peekable<std::str::CharIndices<'a>>,
    tokens: Vec<Token>,
    line: usize,
    column: usize,
    indent_stack: Vec<usize>,
}

impl<'a> Lexer<'a> {
    pub fn new(source: &'a str) -> Self {
        Self {
            source,
            chars: source.char_indices().peekable(),
            tokens: Vec::new(),
            line: 1,
            column: 1,
            indent_stack: vec![0],
        }
    }

    pub fn tokenize(mut self) -> Result<Vec<Token>, SELError> {
        while let Some((pos, ch)) = self.chars.next() {
            let start_column = self.column;

            match ch {
                // Whitespace
                ' ' | '\t' | '\r' => {
                    self.column += 1;
                }
                '\n' => {
                    self.add_token(TokenKind::Newline, "\\n", pos, start_column);
                    self.line += 1;
                    self.column = 1;
                    self.handle_indentation();
                }

                // Single-char tokens
                '(' => {
                    self.add_token(TokenKind::LParen, "(", pos, start_column);
                    self.column += 1;
                }
                ')' => {
                    self.add_token(TokenKind::RParen, ")", pos, start_column);
                    self.column += 1;
                }
                '{' => {
                    self.add_token(TokenKind::LBrace, "{", pos, start_column);
                    self.column += 1;
                }
                '}' => {
                    self.add_token(TokenKind::RBrace, "}", pos, start_column);
                    self.column += 1;
                }
                ',' => {
                    self.add_token(TokenKind::Comma, ",", pos, start_column);
                    self.column += 1;
                }
                ':' => {
                    self.add_token(TokenKind::Colon, ":", pos, start_column);
                    self.column += 1;
                }
                '+' => {
                    self.add_token(TokenKind::Plus, "+", pos, start_column);
                    self.column += 1;
                }
                '-' => {
                    self.add_token(TokenKind::Minus, "-", pos, start_column);
                    self.column += 1;
                }
                '*' => {
                    self.add_token(TokenKind::Star, "*", pos, start_column);
                    self.column += 1;
                }
                '%' => {
                    // Check if this is a modulo operator or start of something else
                    // Usually % follows a number for percent, but that's handled in number()
                    self.add_token(TokenKind::Modulo, "%", pos, start_column);
                    self.column += 1;
                }

                // Two-char tokens
                '.' => {
                    if self.peek_char() == Some('.') {
                        self.chars.next();
                        self.add_token(TokenKind::DotDot, "..", pos, start_column);
                        self.column += 2;
                    } else {
                        self.add_token(TokenKind::Dot, ".", pos, start_column);
                        self.column += 1;
                    }
                }
                '=' => {
                    if self.peek_char() == Some('=') {
                        self.chars.next();
                        self.add_token(TokenKind::Eq, "==", pos, start_column);
                        self.column += 2;
                    } else {
                        self.add_token(TokenKind::Assign, "=", pos, start_column);
                        self.column += 1;
                    }
                }
                '!' => {
                    if self.peek_char() == Some('=') {
                        self.chars.next();
                        self.add_token(TokenKind::Neq, "!=", pos, start_column);
                        self.column += 2;
                    } else {
                        return Err(SELError::lexer("Unexpected character '!'", self.line, start_column));
                    }
                }
                '<' => {
                    if self.peek_char() == Some('=') {
                        self.chars.next();
                        self.add_token(TokenKind::Lte, "<=", pos, start_column);
                        self.column += 2;
                    } else {
                        self.add_token(TokenKind::Lt, "<", pos, start_column);
                        self.column += 1;
                    }
                }
                '>' => {
                    if self.peek_char() == Some('=') {
                        self.chars.next();
                        self.add_token(TokenKind::Gte, ">=", pos, start_column);
                        self.column += 2;
                    } else {
                        self.add_token(TokenKind::Gt, ">", pos, start_column);
                        self.column += 1;
                    }
                }

                // Comments
                '/' => {
                    if self.peek_char() == Some('/') {
                        // Skip to end of line
                        while self.peek_char().is_some_and(|c| c != '\n') {
                            self.chars.next();
                        }
                    } else {
                        self.add_token(TokenKind::Slash, "/", pos, start_column);
                        self.column += 1;
                    }
                }
                '#' => {
                    // Skip to end of line
                    while self.peek_char().is_some_and(|c| c != '\n') {
                        self.chars.next();
                    }
                }

                // String
                '"' | '\'' => {
                    self.string(ch, pos, start_column)?;
                }

                // Variable
                '$' => {
                    self.variable(pos, start_column)?;
                }

                // Number or identifier
                _ if ch.is_ascii_digit() => {
                    self.number(pos, start_column)?;
                }
                _ if ch.is_alphabetic() || ch == '_' => {
                    self.identifier(pos, start_column);
                }

                _ => {
                    return Err(SELError::lexer(
                        format!("Unexpected character '{}'", ch),
                        self.line,
                        start_column,
                    ));
                }
            }
        }

        self.add_token(TokenKind::Eof, "", self.source.len(), self.column);
        Ok(self.tokens)
    }

    fn peek_char(&mut self) -> Option<char> {
        self.chars.peek().map(|(_, ch)| *ch)
    }

    fn add_token(&mut self, kind: TokenKind, value: &str, offset: usize, column: usize) {
        self.tokens.push(Token {
            kind,
            value: value.to_string(),
            location: SourceLocation::new(self.line, column, offset),
        });
    }

    fn string(&mut self, quote: char, start_pos: usize, start_col: usize) -> Result<(), SELError> {
        let mut value = String::new();
        self.column += 1;

        while let Some((_, ch)) = self.chars.next() {
            self.column += 1;
            if ch == quote {
                self.add_token(TokenKind::String, &value, start_pos, start_col);
                return Ok(());
            }
            if ch == '\n' {
                return Err(SELError::lexer("Unterminated string", self.line, start_col));
            }
            value.push(ch);
        }

        Err(SELError::lexer("Unterminated string", self.line, start_col))
    }

    fn variable(&mut self, start_pos: usize, start_col: usize) -> Result<(), SELError> {
        let mut name = String::new();
        self.column += 1;

        while let Some(&(_, ch)) = self.chars.peek() {
            if ch.is_alphanumeric() || ch == '_' {
                name.push(ch);
                self.chars.next();
                self.column += 1;
            } else {
                break;
            }
        }

        if name.is_empty() {
            return Err(SELError::lexer("Expected variable name after $", self.line, start_col));
        }

        self.add_token(TokenKind::Variable, &name, start_pos, start_col);
        Ok(())
    }

    fn number(&mut self, start_pos: usize, start_col: usize) -> Result<(), SELError> {
        let start = start_pos;
        let mut end = start_pos + 1;
        self.column += 1;

        // Consume digits
        while let Some(&(pos, ch)) = self.chars.peek() {
            if ch.is_ascii_digit() || ch == '.' {
                end = pos + 1;
                self.chars.next();
                self.column += 1;
            } else {
                break;
            }
        }

        let num_str = &self.source[start..end];

        // Check for time (HH:MM)
        if self.peek_char() == Some(':') {
            let colon_pos = end;
            self.chars.next();
            self.column += 1;

            if self.peek_char().is_some_and(|c| c.is_ascii_digit()) {
                while let Some(&(pos, ch)) = self.chars.peek() {
                    if ch.is_ascii_digit() {
                        end = pos + 1;
                        self.chars.next();
                        self.column += 1;
                    } else {
                        break;
                    }
                }
                let time_str = &self.source[start..end];
                self.add_token(TokenKind::Time, time_str, start_pos, start_col);
                return Ok(());
            } else {
                // Not a time, backtrack
                // This is tricky - for now, just add as number
                self.add_token(TokenKind::Number, num_str, start_pos, start_col);
                self.add_token(TokenKind::Colon, ":", colon_pos, self.column - 1);
                return Ok(());
            }
        }

        // Check for percent symbol first
        if self.peek_char() == Some('%') {
            self.chars.next();
            self.column += 1;
            self.add_token(TokenKind::Percent, num_str, start_pos, start_col);
            return Ok(());
        }

        // Check for unit suffix
        let mut unit = String::new();
        while let Some(&(_, ch)) = self.chars.peek() {
            if ch.is_alphabetic() {
                unit.push(ch);
                self.chars.next();
                self.column += 1;
            } else {
                break;
            }
        }

        // Check power/energy units first (case-sensitive: W, kW, MW, Wh, kWh, MWh)
        if is_power_or_energy_unit(&unit) {
            let value = format!("{}{}", num_str, unit);
            self.add_token(TokenKind::Number, &value, start_pos, start_col);
        } else if is_duration_unit(&unit) {
            let value = format!("{}{}", num_str, unit);
            self.add_token(TokenKind::Duration, &value, start_pos, start_col);
        } else if !unit.is_empty() {
            // Unknown unit - include in number anyway
            let value = format!("{}{}", num_str, unit);
            self.add_token(TokenKind::Number, &value, start_pos, start_col);
        } else {
            self.add_token(TokenKind::Number, num_str, start_pos, start_col);
        }

        Ok(())
    }

    fn identifier(&mut self, start_pos: usize, start_col: usize) {
        let start = start_pos;
        let mut end = start_pos + 1;
        self.column += 1;

        while let Some(&(pos, ch)) = self.chars.peek() {
            if ch.is_alphanumeric() || ch == '_' {
                end = pos + 1;
                self.chars.next();
                self.column += 1;
            } else {
                break;
            }
        }

        let text = &self.source[start..end];
        let upper = text.to_uppercase();

        // Check for keywords
        let kind = match upper.as_str() {
            "ON" => TokenKind::On,
            "EVERY" => TokenKind::Every,
            "AT" => TokenKind::At,
            "DURING" => TokenKind::During,
            "BETWEEN" => TokenKind::Between,
            "AND" => TokenKind::And,
            "OR" => TokenKind::Or,
            "NOT" => TokenKind::Not,
            "NOTIFY" => TokenKind::Notify,
            "WEBHOOK" => TokenKind::Webhook,
            "LOG" => TokenKind::Log,
            "SET" => TokenKind::Set,
            "COOLDOWN" => TokenKind::Cooldown,
            "IS" => TokenKind::Is,
            "UNUSUAL" => TokenKind::Unusual,
            "COMPARED" => TokenKind::Compared,
            "TO" => TokenKind::To,
            "RISING" => TokenKind::Rising,
            "FALLING" => TokenKind::Falling,
            "STABLE" => TokenKind::Stable,
            _ => {
                // Check for functions
                if is_function(&upper) {
                    TokenKind::Function
                } else if is_metric(text) {
                    TokenKind::Metric
                } else {
                    TokenKind::Identifier
                }
            }
        };

        self.add_token(kind, text, start_pos, start_col);
    }

    fn handle_indentation(&mut self) {
        let mut spaces = 0;

        while let Some(&(_, ch)) = self.chars.peek() {
            match ch {
                ' ' => {
                    spaces += 1;
                    self.chars.next();
                    self.column += 1;
                }
                '\t' => {
                    spaces += 4;
                    self.chars.next();
                    self.column += 1;
                }
                _ => break,
            }
        }

        // Skip blank lines
        if matches!(self.peek_char(), Some('\n') | Some('#')) {
            return;
        }

        let current = *self.indent_stack.last().unwrap();

        if spaces > current {
            self.indent_stack.push(spaces);
            self.add_token(TokenKind::Indent, "", self.column, self.column);
        } else if spaces < current {
            while self.indent_stack.len() > 1 && *self.indent_stack.last().unwrap() > spaces {
                self.indent_stack.pop();
                self.add_token(TokenKind::Dedent, "", self.column, self.column);
            }
        }
    }
}

fn is_function(s: &str) -> bool {
    matches!(s, "AVG" | "MEDIAN" | "SUM" | "MIN" | "MAX" | "COUNT" | "STDDEV" | "TREND" | "PERCENTILE")
}

fn is_metric(s: &str) -> bool {
    matches!(s.to_lowercase().as_str(),
        "pv_power" | "battery_power" | "battery_soc" |
        "grid_power" | "grid_import" | "grid_export" | "load_power"
    )
}

fn is_power_or_energy_unit(s: &str) -> bool {
    // Case-sensitive check for power/energy units
    matches!(s, "W" | "kW" | "MW" | "Wh" | "kWh" | "MWh")
}

fn is_duration_unit(s: &str) -> bool {
    matches!(s.to_lowercase().as_str(), "min" | "hour" | "day" | "week" | "month" | "h" | "d" | "s" | "sec")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_tokens() {
        let lexer = Lexer::new("ON battery_soc < 20%");
        let tokens = lexer.tokenize().unwrap();

        assert_eq!(tokens[0].kind, TokenKind::On);
        assert_eq!(tokens[1].kind, TokenKind::Metric);
        assert_eq!(tokens[1].value, "battery_soc");
        assert_eq!(tokens[2].kind, TokenKind::Lt);
        assert_eq!(tokens[3].kind, TokenKind::Percent);
        assert_eq!(tokens[3].value, "20");
    }

    #[test]
    fn test_variable() {
        let lexer = Lexer::new("$threshold = 20%");
        let tokens = lexer.tokenize().unwrap();

        assert_eq!(tokens[0].kind, TokenKind::Variable);
        assert_eq!(tokens[0].value, "threshold");
        assert_eq!(tokens[1].kind, TokenKind::Assign);
    }

    #[test]
    fn test_time() {
        let lexer = Lexer::new("AT 17:00");
        let tokens = lexer.tokenize().unwrap();

        assert_eq!(tokens[0].kind, TokenKind::At);
        assert_eq!(tokens[1].kind, TokenKind::Time);
        assert_eq!(tokens[1].value, "17:00");
    }
}
