// AI-powered SEL code generation using OpenRouter/Grok

// API key from environment variable - set VITE_OPENROUTER_API_KEY in .env
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-3-haiku'; // More reliable than grok-3-fast

interface AISELResponse {
  success: boolean;
  code?: string;
  explanation?: string;
  error?: string;
}

// Comprehensive SEL Language Reference for AI
const SEL_LANGUAGE_REFERENCE = `
# SEL - Sourceful Energy Language Reference

SEL is a domain-specific language for creating energy automation rules.

## Variables
Define reusable values with $ prefix:
\`\`\`
$threshold = 20%          # Percentage (0-100)
$min_power = 3kW          # Power: W, kW, MW
$energy = 10kWh           # Energy: Wh, kWh, MWh
$check_time = 17:00       # Time in HH:MM format
$wait = 30min             # Duration: s, min, hour, day, week
\`\`\`

## Available Metrics
- pv_power: Solar panel output (W) - always positive when producing
- battery_power: Battery power (W) - positive=charging, negative=discharging
- battery_soc: Battery state of charge (0-100%)
- grid_power: Grid power (W) - positive=importing, negative=exporting
- grid_import: Power imported from grid (W) - always positive
- grid_export: Power exported to grid (W) - always positive
- load_power: House consumption (W) - always positive

## Event Rules (ON)
Trigger when conditions are met:
\`\`\`
ON battery_soc < 20%
  NOTIFY "Battery low!"
  COOLDOWN 30min

ON pv_power > 5kW AND battery_soc < 80%
  NOTIFY "High solar, battery charging"
  COOLDOWN 1hour
\`\`\`

## Schedule Rules (EVERY)
Trigger at specific times:
\`\`\`
EVERY day AT 18:00
  NOTIFY "Daily energy summary"

EVERY monday AT 09:00
  NOTIFY "Weekly report"

EVERY week AT 08:00
  WEBHOOK "https://api.example.com/report"
\`\`\`

Available frequencies: day, daily, week, weekly, month, monthly
Weekdays: monday, tuesday, wednesday, thursday, friday, saturday, sunday

## Comparison Operators
- < : less than
- <= : less than or equal
- > : greater than
- >= : greater than or equal
- == : equal
- != : not equal

## Logical Operators
\`\`\`
ON battery_soc < 20% AND pv_power > 1kW
  NOTIFY "Low battery but sun is shining"

ON battery_soc < 10% OR battery_soc > 95%
  NOTIFY "Battery at extreme level"

ON NOT pv_power > 0
  NOTIFY "No solar production"

ON (battery_soc < 20% OR battery_soc > 90%) AND pv_power > 1kW
  NOTIFY "Complex condition"
\`\`\`

## Trend Detection
React to changing values:
\`\`\`
ON battery_soc RISING
  NOTIFY "Battery charging"

ON pv_power FALLING
  NOTIFY "Solar decreasing"

ON grid_power STABLE
  NOTIFY "Grid usage stable"
\`\`\`

## Anomaly Detection
Compare to historical data:
\`\`\`
ON pv_power IS UNUSUAL COMPARED TO 7day
  NOTIFY "Solar abnormal"
\`\`\`

## Statistical Functions
\`\`\`
ON AVG(pv_power, 1hour) > 5kW
  NOTIFY "Sustained high solar"

ON MAX(battery_soc) > 95%
  NOTIFY "Battery peaked"
\`\`\`
Functions: AVG, MEDIAN, SUM, MIN, MAX, COUNT, STDDEV

## Actions
NOTIFY - Send notification:
  NOTIFY "Your message here"

WEBHOOK - Call external URL:
  WEBHOOK "https://api.example.com/alert"

COOLDOWN - Prevent repeated triggers:
  COOLDOWN 30min

## Template Variables in Messages
Use {metric} to include current values:
\`\`\`
NOTIFY "Battery at {battery_soc}%, solar producing {pv_power}"
\`\`\`

## Complete Examples

### Low Battery Alert with Hysteresis
\`\`\`
$low = 20%
$critical = 10%

ON battery_soc < $critical
  NOTIFY "CRITICAL: Battery at {battery_soc}%!"
  COOLDOWN 5min

ON battery_soc < $low AND battery_soc >= $critical
  NOTIFY "Warning: Battery getting low"
  COOLDOWN 15min
\`\`\`

### Time-of-Day Based Rule
\`\`\`
EVERY day AT 17:00
  NOTIFY "Time to check energy usage"
\`\`\`

### Weekend-Only Alert
\`\`\`
EVERY saturday AT 10:00
  NOTIFY "Weekend energy check"

EVERY sunday AT 10:00
  NOTIFY "Weekend energy check"
\`\`\`

### Export Monitoring
\`\`\`
ON grid_export > 5kW AND battery_soc > 80%
  NOTIFY "Exporting {grid_export} with full battery!"
  COOLDOWN 30min
\`\`\`
`;

const SYSTEM_PROMPT = `You are an expert SEL (Sourceful Energy Language) code generator for home energy automation.

${SEL_LANGUAGE_REFERENCE}

## Your Task
When the user describes what they want in plain language, generate valid SEL code.

## Response Format
Respond ONLY with valid JSON:
{
  "success": true,
  "code": "# Comment describing the rule\\n$var = value\\n\\nON condition\\n  NOTIFY \\"message\\"\\n  COOLDOWN duration",
  "explanation": "Brief explanation of what the code does"
}

If you cannot create a valid rule:
{
  "success": false,
  "error": "Clear explanation of what's needed"
}

## Important Rules
1. Always include comments (# ...) explaining the rule
2. Use proper indentation (2 spaces) for actions under ON/EVERY
3. Include COOLDOWN for event rules to prevent spam
4. Use template variables {metric} in NOTIFY messages
5. For time-based alerts, use EVERY with the appropriate frequency
6. For condition-based alerts, use ON with the metric and threshold
7. Combine multiple conditions with AND/OR when needed
8. ALL output must be in English only - SEL is an English-only language
9. Understand user input in any language, but always generate English SEL code and explanations

## Examples

User: "Alert me when battery is below 20%"
{
  "success": true,
  "code": "# Low battery alert\\n$threshold = 20%\\n\\nON battery_soc < $threshold\\n  NOTIFY \\"Battery low: {battery_soc}%\\"\\n  COOLDOWN 15min",
  "explanation": "Triggers when battery drops below 20%, with 15 minute cooldown"
}

User: "Notify me every Saturday at 10am"
{
  "success": true,
  "code": "# Weekend morning notification\\nEVERY saturday AT 10:00\\n  NOTIFY \\"Saturday energy check\\"",
  "explanation": "Sends a notification every Saturday at 10:00"
}

User: "Tell me when solar is producing and battery is full"
{
  "success": true,
  "code": "# High solar with full battery\\n$battery_full = 90%\\n$solar_min = 1kW\\n\\nON pv_power > $solar_min AND battery_soc > $battery_full\\n  NOTIFY \\"Solar producing {pv_power} with battery at {battery_soc}%\\"\\n  COOLDOWN 1hour",
  "explanation": "Alerts when solar output exceeds 1kW and battery is above 90%"
}`;

export async function parseAutomationIntent(userInput: string): Promise<AISELResponse> {
  // Check if API key is configured
  if (!OPENROUTER_API_KEY) {
    return {
      success: false,
      error: 'AI features not configured. Set VITE_OPENROUTER_API_KEY in .env file.',
    };
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Sourceful EMS Dashboard',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    jsonStr = jsonStr.trim();

    // Try to parse as-is first
    try {
      const parsed = JSON.parse(jsonStr);
      return parsed as AISELResponse;
    } catch {
      // If parsing fails, try to extract key fields manually
      console.log('Attempting manual JSON extraction from:', jsonStr.substring(0, 200));
    }

    // Manual extraction fallback - look for the key fields
    const successMatch = jsonStr.match(/"success"\s*:\s*(true|false)/);
    const codeMatch = jsonStr.match(/"code"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"explanation|"\s*})/);
    const explanationMatch = jsonStr.match(/"explanation"\s*:\s*"([^"]+)"/);
    const errorMatch = jsonStr.match(/"error"\s*:\s*"([^"]+)"/);

    if (successMatch) {
      const success = successMatch[1] === 'true';
      if (success && codeMatch) {
        // Unescape the code - it has escaped newlines that we need to preserve
        let code = codeMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"');
        return {
          success: true,
          code,
          explanation: explanationMatch ? explanationMatch[1] : 'AI-generated rule',
        };
      } else if (!success && errorMatch) {
        return {
          success: false,
          error: errorMatch[1],
        };
      }
    }

    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('AI automation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process your request',
    };
  }
}

// Legacy support - convert AI response to old rule format if needed
export function createRuleFromAI(
  aiResponse: AISELResponse,
  _siteId: string,
  _webhookUrl: string
): { selCode: string } | null {
  if (!aiResponse.success || !aiResponse.code) {
    return null;
  }

  return {
    selCode: aiResponse.code,
  };
}

// Updated suggestion prompts
export const AI_SUGGESTIONS = [
  "Alert me when battery drops below 20%",
  "Notify when solar production exceeds 5kW",
  "Tell me when we're exporting energy to the grid",
  "Send a daily summary at 6 PM",
  "Alert on Saturdays when battery is full",
  "Notify when solar is unusually low",
];

// Export the language reference for documentation
export const SEL_DOCS = SEL_LANGUAGE_REFERENCE;
