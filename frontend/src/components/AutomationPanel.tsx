import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Plus,
  Trash2,
  Play,
  Pause,
  Bell,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Send,
  Loader2,
} from 'lucide-react';
import type {
  AutomationRule,
  AutomationLog,
  MetricType,
  ConditionOperator,
} from '../api/automation-types';
import {
  METRIC_LABELS,
  OPERATOR_LABELS,
  formatCondition,
  generateRuleId,
} from '../api/automation-types';
import { parseAutomationIntent, createRuleFromAI, AI_SUGGESTIONS } from '../api/ai-automation';

interface AutomationPanelProps {
  siteId: string;
}

const STORAGE_KEY = 'ems_automations';
const LOG_STORAGE_KEY = 'ems_automation_logs';

function loadRules(): AutomationRule[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRules(rules: AutomationRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

function loadLogs(): AutomationLog[] {
  try {
    const saved = localStorage.getItem(LOG_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveLogs(logs: AutomationLog[]): void {
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs.slice(-50)));
}

export function AutomationPanel({ siteId }: AutomationPanelProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAIForm, setShowAIForm] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'rules' | 'logs' | null>('rules');
  const [testingRule, setTestingRule] = useState<string | null>(null);

  // AI form state
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<{
    explanation?: string;
    rule?: Partial<AutomationRule>;
    error?: string;
  } | null>(null);
  const [defaultWebhookUrl, setDefaultWebhookUrl] = useState('https://webhook.example.com/notify');

  // Manual form state
  const [newRule, setNewRule] = useState({
    name: '',
    metric: 'battery_soc' as MetricType,
    operator: 'lt' as ConditionOperator,
    value: 20,
    webhookUrl: '',
    cooldownMinutes: 15,
  });

  useEffect(() => {
    setRules(loadRules().filter(r => r.siteId === siteId));
    setLogs(loadLogs().filter(l => rules.some(r => r.id === l.ruleId)));
  }, [siteId]);

  const handleAISubmit = async () => {
    if (!aiInput.trim()) return;

    setAiLoading(true);
    setAiResponse(null);

    const response = await parseAutomationIntent(aiInput);

    if (response.success && response.rule) {
      setAiResponse({
        explanation: response.explanation,
        rule: response.rule,
      });
    } else {
      setAiResponse({
        error: response.error || 'Could not understand your request',
      });
    }

    setAiLoading(false);
  };

  const handleConfirmAIRule = () => {
    if (!aiResponse?.rule) return;

    const rule = createRuleFromAI(
      { success: true, rule: aiResponse.rule },
      siteId,
      defaultWebhookUrl
    );

    if (rule) {
      const updatedRules = [...loadRules(), rule];
      saveRules(updatedRules);
      setRules(updatedRules.filter(r => r.siteId === siteId));
      setShowAIForm(false);
      setAiInput('');
      setAiResponse(null);
    }
  };

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.webhookUrl) return;

    const rule: AutomationRule = {
      id: generateRuleId(),
      name: newRule.name,
      enabled: true,
      siteId,
      condition: {
        metric: newRule.metric,
        operator: newRule.operator,
        value: newRule.value,
      },
      webhookUrl: newRule.webhookUrl,
      cooldownMinutes: newRule.cooldownMinutes,
      createdAt: new Date().toISOString(),
    };

    const updatedRules = [...loadRules(), rule];
    saveRules(updatedRules);
    setRules(updatedRules.filter(r => r.siteId === siteId));
    setShowCreateForm(false);
    setNewRule({
      name: '',
      metric: 'battery_soc',
      operator: 'lt',
      value: 20,
      webhookUrl: '',
      cooldownMinutes: 15,
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = loadRules().filter(r => r.id !== ruleId);
    saveRules(updatedRules);
    setRules(updatedRules.filter(r => r.siteId === siteId));
  };

  const handleToggleRule = (ruleId: string) => {
    const allRules = loadRules();
    const updated = allRules.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    saveRules(updated);
    setRules(updated.filter(r => r.siteId === siteId));
  };

  const handleTestWebhook = async (rule: AutomationRule) => {
    setTestingRule(rule.id);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const log: AutomationLog = {
        id: `log_${Date.now()}`,
        ruleId: rule.id,
        ruleName: rule.name,
        triggeredAt: new Date().toISOString(),
        condition: formatCondition(rule.condition),
        actualValue: 0,
        webhookStatus: 'success',
        webhookResponse: 'Test successful (simulated)',
      };

      const updatedLogs = [...loadLogs(), log];
      saveLogs(updatedLogs);
      setLogs(updatedLogs.filter(l => rules.some(r => r.id === l.ruleId)));
    } catch (error) {
      console.error('Webhook test failed:', error);
    } finally {
      setTestingRule(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/30 rounded-2xl border border-gray-700/30 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Automations</h3>
            <p className="text-gray-500 text-xs">
              {rules.filter(r => r.enabled).length} active rules
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowAIForm(true); setShowCreateForm(false); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 rounded-lg text-sm hover:from-purple-500/30 hover:to-pink-500/30 transition-colors border border-purple-500/30"
          >
            <Sparkles className="w-4 h-4" />
            AI Create
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowCreateForm(true); setShowAIForm(false); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Manual
          </motion.button>
        </div>
      </div>

      {/* AI Create Form */}
      <AnimatePresence>
        {showAIForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-gray-700/30 overflow-hidden"
          >
            <div className="p-4 bg-gradient-to-br from-purple-900/20 to-pink-900/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h4 className="text-white font-medium">Create with AI</h4>
                </div>
                <button
                  onClick={() => { setShowAIForm(false); setAiResponse(null); setAiInput(''); }}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-gray-400 text-sm mb-4">
                Describe what you want in plain English, and AI will create the automation rule for you.
              </p>

              {/* Suggestions */}
              <div className="flex flex-wrap gap-2 mb-4">
                {AI_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAiInput(suggestion)}
                    className="px-2 py-1 bg-gray-800/50 text-gray-400 text-xs rounded-lg hover:bg-gray-700/50 hover:text-white transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAISubmit()}
                  placeholder="e.g., Alert me when battery drops below 20%"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 focus:outline-none placeholder-gray-500"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAISubmit}
                  disabled={aiLoading || !aiInput.trim()}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              </div>

              {/* AI Response */}
              <AnimatePresence>
                {aiResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-xl ${
                      aiResponse.error
                        ? 'bg-red-900/30 border border-red-500/30'
                        : 'bg-green-900/30 border border-green-500/30'
                    }`}
                  >
                    {aiResponse.error ? (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                        <p className="text-red-300 text-sm">{aiResponse.error}</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 mb-3">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                          <div>
                            <p className="text-green-300 text-sm font-medium">
                              {aiResponse.rule?.name}
                            </p>
                            <p className="text-gray-400 text-xs mt-1">
                              {aiResponse.explanation}
                            </p>
                          </div>
                        </div>

                        {/* Webhook URL */}
                        <div className="mb-3">
                          <label className="block text-gray-400 text-xs mb-1">Webhook URL</label>
                          <input
                            type="url"
                            value={defaultWebhookUrl}
                            onChange={(e) => setDefaultWebhookUrl(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-green-500 focus:outline-none"
                          />
                        </div>

                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleConfirmAIRule}
                            className="flex-1 py-2 bg-green-500 text-black font-medium rounded-lg hover:bg-green-400 transition-colors"
                          >
                            Create Rule
                          </motion.button>
                          <button
                            onClick={() => setAiResponse(null)}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                          >
                            Try Again
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-gray-700/30 overflow-hidden"
          >
            <div className="p-4 bg-gray-900/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-medium">Create Rule Manually</h4>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Rule Name</label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Low Battery Alert"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Metric</label>
                    <select
                      value={newRule.metric}
                      onChange={(e) => setNewRule({ ...newRule, metric: e.target.value as MetricType })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                    >
                      {Object.entries(METRIC_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Condition</label>
                    <select
                      value={newRule.operator}
                      onChange={(e) => setNewRule({ ...newRule, operator: e.target.value as ConditionOperator })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                    >
                      {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Value</label>
                    <input
                      type="number"
                      value={newRule.value}
                      onChange={(e) => setNewRule({ ...newRule, value: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Webhook URL</label>
                  <input
                    type="url"
                    value={newRule.webhookUrl}
                    onChange={(e) => setNewRule({ ...newRule, webhookUrl: e.target.value })}
                    placeholder="https://your-webhook-url.com/notify"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Cooldown (minutes)</label>
                  <input
                    type="number"
                    value={newRule.cooldownMinutes}
                    onChange={(e) => setNewRule({ ...newRule, cooldownMinutes: Number(e.target.value) })}
                    min={1}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateRule}
                    disabled={!newRule.name || !newRule.webhookUrl}
                    className="flex-1 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Rule
                  </motion.button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Section */}
      <div>
        <button
          onClick={() => setExpandedSection(expandedSection === 'rules' ? null : 'rules')}
          className="w-full p-3 flex items-center justify-between text-gray-400 hover:bg-gray-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="text-sm font-medium">Rules ({rules.length})</span>
          </div>
          {expandedSection === 'rules' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        <AnimatePresence>
          {expandedSection === 'rules' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {rules.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-purple-400/50" />
                  <p>No automation rules yet.</p>
                  <p className="text-xs mt-1">Try the AI Create button to get started!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {rules.map((rule) => (
                    <div key={rule.id} className="p-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
                          <span className="text-white text-sm font-medium">{rule.name}</span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1">
                          {formatCondition(rule.condition)}
                        </p>
                        <p className="text-gray-600 text-xs mt-0.5">
                          Cooldown: {rule.cooldownMinutes}min
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleTestWebhook(rule)}
                          disabled={testingRule === rule.id}
                          className="p-1.5 text-blue-400 hover:bg-blue-400/20 rounded transition-colors disabled:opacity-50"
                          title="Test webhook"
                        >
                          {testingRule === rule.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              <Zap className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleRule(rule.id)}
                          className={`p-1.5 rounded transition-colors ${
                            rule.enabled
                              ? 'text-green-400 hover:bg-green-400/20'
                              : 'text-gray-500 hover:bg-gray-500/20'
                          }`}
                          title={rule.enabled ? 'Disable' : 'Enable'}
                        >
                          {rule.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-red-400 hover:bg-red-400/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logs Section */}
      <div className="border-t border-gray-700/30">
        <button
          onClick={() => setExpandedSection(expandedSection === 'logs' ? null : 'logs')}
          className="w-full p-3 flex items-center justify-between text-gray-400 hover:bg-gray-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Activity Log ({logs.length})</span>
          </div>
          {expandedSection === 'logs' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        <AnimatePresence>
          {expandedSection === 'logs' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden max-h-64 overflow-y-auto"
            >
              {logs.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No activity yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {logs.slice().reverse().map((log) => (
                    <div key={log.id} className="p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.webhookStatus === 'success' ? (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                          )}
                          <span className="text-white">{log.ruleName}</span>
                        </div>
                        <span className="text-gray-600">
                          {new Date(log.triggeredAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-500 mt-1">{log.condition}</p>
                      {log.webhookResponse && (
                        <p className="text-gray-600 mt-0.5 truncate">{log.webhookResponse}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
