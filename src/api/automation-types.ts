// Automation rule types for webhook triggers

export type MetricType = 'battery_soc' | 'battery_power' | 'pv_power' | 'grid_power' | 'load_power';

export type ConditionOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

export type TriggerType = 'threshold' | 'change' | 'time_above' | 'time_below';

export interface AutomationCondition {
  metric: MetricType;
  operator: ConditionOperator;
  value: number;
  durationSeconds?: number; // For time-based conditions
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  siteId: string;
  condition: AutomationCondition;
  webhookUrl: string;
  cooldownMinutes: number; // Prevent spam
  createdAt: string;
  lastTriggeredAt?: string;
}

export interface AutomationLog {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: string;
  condition: string;
  actualValue: number;
  webhookStatus: 'success' | 'failed' | 'pending';
  webhookResponse?: string;
}

// Helper functions
export const METRIC_LABELS: Record<MetricType, string> = {
  battery_soc: 'Battery SoC (%)',
  battery_power: 'Battery Power (W)',
  pv_power: 'Solar Power (W)',
  grid_power: 'Grid Power (W)',
  load_power: 'Load Power (W)',
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  eq: '=',
};

export function evaluateCondition(
  condition: AutomationCondition,
  currentValue: number
): boolean {
  const { operator, value } = condition;

  switch (operator) {
    case 'gt': return currentValue > value;
    case 'lt': return currentValue < value;
    case 'gte': return currentValue >= value;
    case 'lte': return currentValue <= value;
    case 'eq': return Math.abs(currentValue - value) < 0.01;
    default: return false;
  }
}

export function formatCondition(condition: AutomationCondition): string {
  const metricLabel = METRIC_LABELS[condition.metric];
  const op = OPERATOR_LABELS[condition.operator];
  const unit = condition.metric === 'battery_soc' ? '%' : 'W';

  let text = `${metricLabel} ${op} ${condition.value}${unit}`;

  if (condition.durationSeconds) {
    text += ` for ${condition.durationSeconds}s`;
  }

  return text;
}

export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
