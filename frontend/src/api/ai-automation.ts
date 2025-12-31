// AI-powered automation using OpenRouter/Grok

import type { AutomationRule, MetricType, ConditionOperator } from './automation-types';
import { generateRuleId } from './automation-types';

// API key from environment variable - set VITE_OPENROUTER_API_KEY in .env
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'x-ai/grok-code-fast-1';

interface AIAutomationResponse {
  success: boolean;
  rule?: Partial<AutomationRule>;
  explanation?: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an energy management automation assistant. Your job is to help users create automation rules for their home energy system.

The user has access to these metrics:
- battery_soc: Battery State of Charge (0-100%)
- battery_power: Battery Power in Watts (positive = charging, negative = discharging)
- pv_power: Solar/PV Power in Watts (always positive when producing)
- grid_power: Grid Power in Watts (positive = importing, negative = exporting)
- load_power: House Load Power in Watts (always positive)

Available conditions: gt (>), lt (<), gte (>=), lte (<=), eq (=)

When the user describes what they want, extract:
1. The metric they want to monitor
2. The condition (above, below, equals, etc.)
3. The threshold value
4. A clear name for the rule
5. An optional cooldown period (default 15 minutes)

Respond ONLY with valid JSON in this exact format:
{
  "success": true,
  "rule": {
    "name": "Rule name here",
    "metric": "battery_soc",
    "operator": "lt",
    "value": 20,
    "cooldownMinutes": 15
  },
  "explanation": "Human readable explanation of what this rule does"
}

If you cannot understand or create a valid rule, respond with:
{
  "success": false,
  "error": "Explanation of what went wrong or what you need to know"
}

Examples:
- "Alert when battery is low" -> battery_soc lt 20
- "Notify when solar produces more than 3kW" -> pv_power gt 3000
- "Tell me when we're exporting to grid" -> grid_power lt 0
- "Alert when battery is fully charged" -> battery_soc gte 100
- "Let me know when load is high" -> load_power gt 5000`;

export async function parseAutomationIntent(userInput: string): Promise<AIAutomationResponse> {
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
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    return parsed as AIAutomationResponse;
  } catch (error) {
    console.error('AI automation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process your request',
    };
  }
}

export function createRuleFromAI(
  aiResponse: AIAutomationResponse,
  siteId: string,
  webhookUrl: string
): AutomationRule | null {
  if (!aiResponse.success || !aiResponse.rule) {
    return null;
  }

  const { rule } = aiResponse;

  return {
    id: generateRuleId(),
    name: rule.name || 'AI Generated Rule',
    enabled: true,
    siteId,
    condition: {
      metric: (rule.metric || 'battery_soc') as MetricType,
      operator: (rule.operator || 'lt') as ConditionOperator,
      value: rule.value || 0,
    },
    webhookUrl,
    cooldownMinutes: rule.cooldownMinutes || 15,
    createdAt: new Date().toISOString(),
  };
}

// Suggestion prompts for users
export const AI_SUGGESTIONS = [
  "Alert me when battery drops below 20%",
  "Notify when solar production exceeds 3kW",
  "Tell me when we're exporting energy to the grid",
  "Alert when house load is very high",
  "Let me know when battery is fully charged",
];
