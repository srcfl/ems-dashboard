import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { selClient } from '../api/sel-client';

interface SELEditorProps {
  initialCode?: string;
  onCompile?: (code: string, json: string) => void;
  onError?: (error: string) => void;
  readOnly?: boolean;
  siteId?: string; // Optional site ID for storing rules
}

// SEL Keywords for syntax highlighting
const KEYWORDS = ['ON', 'EVERY', 'AT', 'DURING', 'BETWEEN', 'AND', 'OR', 'NOT', 'NOTIFY', 'WEBHOOK', 'LOG', 'SET', 'COOLDOWN', 'IS', 'UNUSUAL', 'COMPARED', 'TO', 'RISING', 'FALLING', 'STABLE'];
const FUNCTIONS = ['AVG', 'MEDIAN', 'SUM', 'MIN', 'MAX', 'COUNT', 'STDDEV', 'TREND', 'PERCENTILE'];
const METRICS = ['pv_power', 'battery_power', 'battery_soc', 'grid_power', 'grid_import', 'grid_export', 'load_power'];
const TIME_UNITS = ['min', 'hour', 'day', 'week', 'month', 's', 'h', 'd', 'w', 'm'];

// Simple tokenizer for syntax highlighting
function tokenize(code: string): { type: string; value: string; }[] {
  const tokens: { type: string; value: string; }[] = [];
  const regex = /(\$\w+)|(\d+(?:\.\d+)?(?:%|kW|MW|W|kWh|MWh|Wh|min|hour|day|week|month|s|h|d|w|m)?)|(\d{1,2}:\d{2})|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(#[^\n]*)|([a-zA-Z_]\w*)|([<>=!]+)|([+\-*/%])|(\(|\)|\{|\}|,|:)|(\s+)/g;

  let match;
  while ((match = regex.exec(code)) !== null) {
    const value = match[0];
    let type = 'text';

    if (match[1]) type = 'variable';
    else if (match[2]) {
      if (value.endsWith('%')) type = 'percent';
      else if (/kW|MW|W|kWh|MWh|Wh/.test(value)) type = 'power';
      else if (/min|hour|day|week|month|[shdwm]$/.test(value)) type = 'duration';
      else type = 'number';
    }
    else if (match[3]) type = 'time';
    else if (match[4] || match[5]) type = 'string';
    else if (match[6]) type = 'comment';
    else if (match[7]) {
      const upper = value.toUpperCase();
      if (KEYWORDS.includes(upper)) type = 'keyword';
      else if (FUNCTIONS.includes(upper)) type = 'function';
      else if (METRICS.includes(value.toLowerCase())) type = 'metric';
      else type = 'identifier';
    }
    else if (match[8]) type = 'operator';
    else if (match[9]) type = 'operator';
    else if (match[10]) type = 'punctuation';
    else if (match[11]) type = 'whitespace';

    tokens.push({ type, value });
  }

  return tokens;
}

// Strict validator
function validate(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = code.split('\n');
  const definedVariables = new Set<string>();

  // Valid tokens
  const VALID_KEYWORDS = [...KEYWORDS, ...FUNCTIONS, ...METRICS, 'day', 'daily', 'week', 'weekly', 'month', 'monthly', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const VALID_UNITS = ['%', 'W', 'kW', 'MW', 'Wh', 'kWh', 'MWh', 'min', 'hour', 'day', 'week', 'month', 's', 'h', 'd', 'w', 'm'];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    // Check for unmatched quotes
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) errors.push(`Line ${i + 1}: Unmatched single quote`);
    if (doubleQuotes % 2 !== 0) errors.push(`Line ${i + 1}: Unmatched double quote`);

    // Remove strings from analysis
    const withoutStrings = trimmed.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");

    // Tokenize the line
    const tokens = withoutStrings.match(/\$\w+|\d+(?:\.\d+)?[a-zA-Z%]*|\d{1,2}:\d{2}|[a-zA-Z_]\w*|[<>=!]+|[+\-*/%(){},:]/g) || [];

    tokens.forEach(token => {
      // Variable definition
      if (token.startsWith('$')) {
        const varName = token.slice(1);
        if (!/^\w+$/.test(varName)) {
          errors.push(`Line ${i + 1}: Invalid variable name '${token}'`);
        }
        // Check if this is a definition (followed by =)
        if (withoutStrings.includes(`${token} =`) || withoutStrings.includes(`${token}=`)) {
          definedVariables.add(varName);
        }
        return;
      }

      // Number with unit
      if (/^\d/.test(token)) {
        // Time format HH:MM
        if (/^\d{1,2}:\d{2}$/.test(token)) return;

        // Number with optional unit
        const match = token.match(/^(\d+(?:\.\d+)?)([a-zA-Z%]*)$/);
        if (match) {
          const unit = match[2];
          if (unit && !VALID_UNITS.some(u => unit.toLowerCase() === u.toLowerCase() || unit === u)) {
            errors.push(`Line ${i + 1}: Unknown unit '${unit}' in '${token}'`);
          }
        }
        return;
      }

      // Operators and punctuation
      if (/^[<>=!+\-*/%(){},:]+$/.test(token)) return;

      // Keywords and identifiers
      if (/^[a-zA-Z_]\w*$/.test(token)) {
        const upper = token.toUpperCase();
        const lower = token.toLowerCase();

        // Check if it's a valid keyword/function/metric
        const isValid = VALID_KEYWORDS.some(k =>
          k.toUpperCase() === upper || k.toLowerCase() === lower
        );

        if (!isValid) {
          errors.push(`Line ${i + 1}: Unknown keyword '${token}'`);
        }
      }
    });
  });

  // Second pass: check for undefined variables
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    // Find variable usages (not definitions)
    const varUsages = trimmed.match(/\$\w+/g) || [];
    varUsages.forEach(v => {
      const varName = v.slice(1);
      // Skip if this line is the definition
      if (trimmed.includes(`${v} =`) || trimmed.includes(`${v}=`)) return;

      if (!definedVariables.has(varName)) {
        errors.push(`Line ${i + 1}: Undefined variable '${v}'`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

// Syntax highlighting component
function HighlightedCode({ code }: { code: string }) {
  const tokens = useMemo(() => tokenize(code), [code]);

  const getTokenClass = (type: string): string => {
    const classes: Record<string, string> = {
      keyword: 'text-purple-400 font-semibold',
      function: 'text-blue-400',
      metric: 'text-green-400',
      variable: 'text-yellow-400',
      string: 'text-orange-300',
      number: 'text-cyan-400',
      percent: 'text-cyan-400',
      power: 'text-cyan-400',
      duration: 'text-cyan-400',
      time: 'text-pink-400',
      operator: 'text-gray-300',
      comment: 'text-gray-500 italic',
      punctuation: 'text-gray-400',
      identifier: 'text-gray-200',
      whitespace: '',
      text: 'text-gray-200',
    };
    return classes[type] || 'text-gray-200';
  };

  return (
    <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
      {tokens.map((token, i) => (
        <span key={i} className={getTokenClass(token.type)}>
          {token.value}
        </span>
      ))}
    </pre>
  );
}

// Example templates
const TEMPLATES = [
  {
    name: 'Low Battery Alert',
    code: `# Low battery warning
$threshold = 20%

ON battery_soc < $threshold
  NOTIFY "Battery low: {battery_soc}%"
  COOLDOWN 30min`
  },
  {
    name: 'High Solar Production',
    code: `# Celebrate high solar output
$high_power = 8kW

ON pv_power > $high_power
  NOTIFY "Excellent solar: {pv_power}!"
  COOLDOWN 1hour`
  },
  {
    name: 'Daily Summary',
    code: `# Daily energy report
EVERY day AT 18:00
  NOTIFY "Daily energy summary ready"
  WEBHOOK "https://api.example.com/report"`
  },
  {
    name: 'Anomaly Detection',
    code: `# Detect unusual production
ON pv_power IS UNUSUAL COMPARED TO 7day
  NOTIFY "Solar production is abnormal"
  COOLDOWN 2hour`
  },
  {
    name: 'Grid Export Monitor',
    code: `# Monitor grid export with full battery
ON grid_export > 5kW AND battery_soc > 80%
  NOTIFY "Exporting with full battery!"
  COOLDOWN 30min`
  }
];

export default function SELEditor({ initialCode = '', onCompile, onError, readOnly = false, siteId }: SELEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [showTemplates, setShowTemplates] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compiledJson, setCompiledJson] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const highlightRef = React.useRef<HTMLPreElement>(null);

  // Check backend availability on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const health = await selClient.health();
        setBackendAvailable(health.status === 'ok');
        setBackendVersion(health.version);
      } catch {
        setBackendAvailable(false);
      }
    };
    checkBackend();
  }, []);

  const handleCodeChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    setCompiledJson(null);

    // Use backend validation if available, otherwise fall back to frontend
    if (backendAvailable && newCode.trim()) {
      setValidating(true);
      try {
        const result = await selClient.validate(newCode);
        setValidationResult({
          valid: result.valid,
          errors: result.error ? [result.error] : [],
        });
      } catch {
        // Fall back to frontend validation
        setValidationResult(validate(newCode));
      } finally {
        setValidating(false);
      }
    } else {
      // Frontend-only validation
      setValidationResult(validate(newCode));
    }
  }, [backendAvailable]);

  // Sync scroll between textarea and highlight
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleCompile = useCallback(async () => {
    // Don't compile if validation failed
    if (validationResult && !validationResult.valid) {
      onError?.(validationResult.errors.join('\n'));
      return;
    }

    setCompiling(true);
    try {
      // Use backend compilation if available
      if (backendAvailable) {
        const result = await selClient.compile(code);
        if (result.success && result.compiled) {
          const json = JSON.stringify(result.compiled, null, 2);
          setCompiledJson(json);
          onCompile?.(code, json);
        } else {
          onError?.(result.error || 'Compilation failed');
        }
      } else {
        // Fallback to frontend-only compilation
        const json = compileFrontendOnly(code);
        setCompiledJson(json);
        onCompile?.(code, json);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Compilation failed');
    } finally {
      setCompiling(false);
    }
  }, [code, validationResult, backendAvailable, onCompile, onError]);

  // Fallback frontend-only compilation
  const compileFrontendOnly = (sourceCode: string): string => {
    const lines = sourceCode.split('\n');
    const variables: { name: string; value: string; normalized: number }[] = [];
    const rules: {
      id: string;
      rule_type: 'Event' | 'Schedule';
      condition?: string;
      schedule?: { type: string; at?: string; frequency?: string };
      actions: { action_type: string; message?: string; url?: string }[];
      cooldown_seconds?: number;
      enabled: boolean;
    }[] = [];

    let currentRule: typeof rules[0] | null = null;
    let ruleCounter = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;

      // Variable definition
      const varMatch = trimmed.match(/^\$(\w+)\s*=\s*(.+)$/);
      if (varMatch) {
        const [, name, valueStr] = varMatch;
        let normalized = 0;
        const percentMatch = valueStr.match(/^(\d+(?:\.\d+)?)%$/);
        const powerMatch = valueStr.match(/^(\d+(?:\.\d+)?)(k?W)$/i);
        const durationMatch = valueStr.match(/^(\d+)(min|hour|day|h|m|s)$/i);
        if (percentMatch) normalized = parseFloat(percentMatch[1]) / 100;
        else if (powerMatch) normalized = parseFloat(powerMatch[1]) * (powerMatch[2].toLowerCase() === 'kw' ? 1000 : 1);
        else if (durationMatch) {
          const num = parseInt(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          if (unit === 'min' || unit === 'm') normalized = num * 60;
          else if (unit === 'hour' || unit === 'h') normalized = num * 3600;
          else if (unit === 'day') normalized = num * 86400;
          else normalized = num;
        }
        variables.push({ name, value: valueStr, normalized });
        return;
      }

      // Event rule start
      if (trimmed.startsWith('ON ')) {
        if (currentRule) rules.push(currentRule);
        currentRule = {
          id: `rule_${++ruleCounter}`,
          rule_type: 'Event',
          condition: trimmed.slice(3).trim(),
          actions: [],
          enabled: true,
        };
        return;
      }

      // Schedule rule start
      if (trimmed.startsWith('EVERY ')) {
        if (currentRule) rules.push(currentRule);
        const scheduleStr = trimmed.slice(6).trim();
        const atMatch = scheduleStr.match(/^(\w+)\s+AT\s+(\d{1,2}:\d{2})/i);
        currentRule = {
          id: `rule_${++ruleCounter}`,
          rule_type: 'Schedule',
          schedule: {
            type: 'calendar',
            frequency: atMatch ? atMatch[1].toLowerCase() : 'daily',
            at: atMatch ? atMatch[2] : undefined,
          },
          actions: [],
          enabled: true,
        };
        return;
      }

      // Actions (indented under a rule)
      if (currentRule && indent > 0) {
        if (trimmed.startsWith('NOTIFY ')) {
          const msgMatch = trimmed.match(/NOTIFY\s+["'](.+)["']/);
          currentRule.actions.push({
            action_type: 'notify',
            message: msgMatch ? msgMatch[1] : trimmed.slice(7),
          });
        } else if (trimmed.startsWith('WEBHOOK ')) {
          const urlMatch = trimmed.match(/WEBHOOK\s+["'](.+)["']/);
          currentRule.actions.push({
            action_type: 'webhook',
            url: urlMatch ? urlMatch[1] : trimmed.slice(8),
          });
        } else if (trimmed.startsWith('COOLDOWN ')) {
          const cdMatch = trimmed.match(/COOLDOWN\s+(\d+)(min|hour|h|m|s)?/i);
          if (cdMatch) {
            const num = parseInt(cdMatch[1]);
            const unit = (cdMatch[2] || 'min').toLowerCase();
            let seconds = num;
            if (unit === 'min' || unit === 'm') seconds = num * 60;
            else if (unit === 'hour' || unit === 'h') seconds = num * 3600;
            currentRule.cooldown_seconds = seconds;
          }
        }
      }
    });

    if (currentRule) rules.push(currentRule);

    const compiled = {
      version: "1.0",
      compiled_at: new Date().toISOString(),
      checksum: btoa(sourceCode.slice(0, 100)).slice(0, 16),
      variables,
      rules,
      required_metrics: [...new Set(
        (sourceCode.match(/pv_power|battery_power|battery_soc|grid_power|grid_import|grid_export|load_power/g) || [])
      )],
      requires_history: sourceCode.includes('UNUSUAL') || sourceCode.includes('AVG') || sourceCode.includes('MEDIAN'),
      source: sourceCode,
    };

    return JSON.stringify(compiled, null, 2);
  };

  const loadTemplate = useCallback((template: typeof TEMPLATES[0]) => {
    setCode(template.code);
    setShowTemplates(false);
    setCompiledJson(null);
    setValidationResult(validate(template.code));
  }, []);

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gray-800/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-sm font-medium text-gray-300">SEL Editor</span>
          {/* Backend status indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
            backendAvailable === null ? 'bg-gray-700/50 text-gray-400' :
            backendAvailable ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              backendAvailable === null ? 'bg-gray-400 animate-pulse' :
              backendAvailable ? 'bg-green-400' : 'bg-yellow-400'
            }`} />
            {backendAvailable === null ? 'Checking...' :
             backendAvailable ? `Backend v${backendVersion}` : 'Offline mode'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"
          >
            Templates
          </button>
          {!readOnly && (
            <button
              onClick={handleCompile}
              disabled={compiling || (validationResult && !validationResult.valid)}
              className="px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {compiling ? 'Compiling...' : 'Compile'}
            </button>
          )}
        </div>
      </div>

      {/* Templates dropdown */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-700/50 overflow-hidden"
          >
            <div className="p-3 bg-gray-800/30 grid grid-cols-2 md:grid-cols-5 gap-2">
              {TEMPLATES.map((template, i) => (
                <button
                  key={i}
                  onClick={() => loadTemplate(template)}
                  className="px-3 py-2 text-xs text-left text-gray-300 bg-gray-700/30 rounded-lg hover:bg-gray-600/50 transition-colors"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor area - unified with overlay highlighting */}
      <div className="relative h-64 bg-gray-950/30">
        {/* Syntax highlighted layer (behind) */}
        <pre
          ref={highlightRef}
          className="absolute inset-0 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-auto pointer-events-none"
          aria-hidden="true"
        >
          {code ? <HighlightedCode code={code + '\n'} /> : (
            <span className="text-gray-600">
              {`# Write your SEL automation rules here\n\n$threshold = 20%\n\nON battery_soc < $threshold\n  NOTIFY "Battery low!"\n  COOLDOWN 30min`}
            </span>
          )}
        </pre>

        {/* Transparent textarea (on top for input) */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleCodeChange}
          onScroll={handleScroll}
          readOnly={readOnly}
          className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white font-mono text-sm leading-relaxed resize-none focus:outline-none"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />

        {/* Validation indicator */}
        {code.trim() && (
          <div className={`absolute bottom-3 right-3 flex items-center gap-2 text-xs px-2 py-1 rounded-md ${
            validating ? 'bg-blue-900/50 text-blue-400' :
            validationResult?.valid ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              validating ? 'bg-blue-400 animate-pulse' :
              validationResult?.valid ? 'bg-green-400' : 'bg-red-400'
            }`} />
            {validating ? 'Validating...' :
             validationResult?.valid ? 'Valid' : `${validationResult?.errors.length || 0} error(s)`}
          </div>
        )}
      </div>

      {/* Errors */}
      <AnimatePresence>
        {validationResult && !validationResult.valid && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-red-900/50 bg-red-950/30 overflow-hidden"
          >
            <div className="p-3">
              <div className="text-xs font-medium text-red-400 mb-1">Errors:</div>
              {validationResult.errors.map((error, i) => (
                <div key={i} className="text-xs text-red-300/80 font-mono">{error}</div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compiled output */}
      <AnimatePresence>
        {compiledJson && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700/50 overflow-hidden"
          >
            <div className="p-3 bg-gray-800/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400">Compiled Output</span>
                <button
                  onClick={() => navigator.clipboard.writeText(compiledJson)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Copy JSON
                </button>
              </div>
              <pre className="text-xs text-green-400 font-mono bg-gray-900/50 p-3 rounded-lg overflow-auto max-h-40">
                {compiledJson}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer with quick reference */}
      <div className="px-4 py-2 border-t border-gray-700/50 bg-gray-800/50">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-300 font-medium">Quick:</span>
          <code className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">ON</code>
          <code className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded">EVERY</code>
          <code className="px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">AVG()</code>
          <code className="px-1.5 py-0.5 bg-emerald-900/50 text-emerald-300 rounded">battery_soc</code>
          <code className="px-1.5 py-0.5 bg-amber-900/50 text-amber-300 rounded">$var</code>
          <code className="px-1.5 py-0.5 bg-cyan-900/50 text-cyan-300 rounded">30min</code>
          <code className="px-1.5 py-0.5 bg-pink-900/50 text-pink-300 rounded">17:00</code>
        </div>
      </div>
    </div>
  );
}
