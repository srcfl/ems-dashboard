import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Trash2,
  Bell,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Code2,
  Pencil,
  Save,
  X,
  Power,
  Plus,
  Wand2,
  Activity,
} from 'lucide-react';
import SELEditor from './SELEditor';
import { parseAutomationIntent, AI_SUGGESTIONS } from '../api/ai-automation';
import { selClient } from '../api/sel-client';
import type { CheckSchedulesResponse } from '../api/sel-client';
import { useSELAuth } from '../hooks/useSELAuth';

interface SELRule {
  id: string;
  name: string;
  siteId: string;
  selCode: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface AutomationLog {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: string;
  message: string;
  status: 'success' | 'error';
}

interface AutomationPanelProps {
  siteId: string;
  isDemoMode?: boolean;
}

// How often to check scheduled rules (in ms)
const SCHEDULER_INTERVAL = 30000; // 30 seconds

// Storage helpers - site-specific keys
function getStorageKey(siteId: string): string {
  return `ems_sel_rules_${siteId}`;
}

function getLogStorageKey(siteId: string): string {
  return `ems_automation_logs_${siteId}`;
}

function loadRules(siteId: string): SELRule[] {
  try {
    const saved = localStorage.getItem(getStorageKey(siteId));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRules(siteId: string, rules: SELRule[]): void {
  localStorage.setItem(getStorageKey(siteId), JSON.stringify(rules));
}

function loadLogs(siteId: string): AutomationLog[] {
  try {
    const saved = localStorage.getItem(getLogStorageKey(siteId));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveLogs(siteId: string, logs: AutomationLog[]): void {
  // Keep only last 100 logs
  const trimmed = logs.slice(-100);
  localStorage.setItem(getLogStorageKey(siteId), JSON.stringify(trimmed));
}

function addLog(siteId: string, log: Omit<AutomationLog, 'id'>): AutomationLog {
  const newLog: AutomationLog = {
    ...log,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  const logs = [...loadLogs(siteId), newLog];
  saveLogs(siteId, logs);
  return newLog;
}

// Demo rules - shown in demo mode only
const DEMO_RULES: SELRule[] = [
  {
    id: 'demo_rule_1',
    name: 'Low Battery Alert',
    siteId: 'demo',
    selCode: `# Alert when battery is low
ON battery_soc < 20%
  NOTIFY "Battery low: {battery_soc}%"
  COOLDOWN 30min`,
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_rule_2',
    name: 'High Export Notification',
    siteId: 'demo',
    selCode: `# Notify when exporting significant power
ON grid_export > 5kW AND battery_soc > 80%
  NOTIFY "High grid export with full battery!"
  COOLDOWN 1hour`,
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo_rule_3',
    name: 'Daily Status Report',
    siteId: 'demo',
    selCode: `# Daily status webhook
EVERY day AT 18:00
  WEBHOOK "https://api.example.com/daily-report"`,
    enabled: false,
    createdAt: new Date().toISOString(),
  },
];

// Default template for new rules
const NEW_RULE_TEMPLATE = `# My new automation rule
# Describe what this rule should do

# Example: Alert when battery is low
# ON battery_soc < 20%
#   NOTIFY "Battery low: {battery_soc}%"
#   COOLDOWN 15min
`;

export function AutomationPanel({ siteId, isDemoMode = false }: AutomationPanelProps) {
  const [rules, setRules] = useState<SELRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [expandedSection, setExpandedSection] = useState<'rules' | 'logs' | null>('rules');

  // SEL backend auth - session generated on-demand when making changes
  const { hasSession, generateSession, canSign } = useSELAuth();

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editorCode, setEditorCode] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [editingRule, setEditingRule] = useState<SELRule | null>(null);
  const [saving, setSaving] = useState(false);

  // AI state
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Track if scheduler is running
  const [schedulerActive, setSchedulerActive] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const schedulerRef = useRef<number | null>(null);

  // Helper to ensure we have a valid session before making authenticated calls
  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (hasSession) return true;
    if (!canSign) return false;

    const session = await generateSession();
    return session !== null;
  }, [hasSession, canSign, generateSession]);

  // Load rules and logs on mount
  useEffect(() => {
    if (isDemoMode) {
      // Demo mode: use predefined demo rules, don't persist
      setRules(DEMO_RULES);
      setLogs([]);
    } else {
      // Real mode: load from localStorage
      setRules(loadRules(siteId));
      setLogs(loadLogs(siteId));
    }
  }, [siteId, isDemoMode]);

  // Sync enabled rules to SEL backend whenever rules change (only in real mode)
  const syncRulesToBackend = useCallback(async (rulesToSync: SELRule[]) => {
    if (isDemoMode) return; // Don't sync in demo mode

    const enabledRules = rulesToSync.filter(r => r.enabled);
    if (enabledRules.length === 0) {
      console.log('[SEL] No enabled rules to sync');
      return;
    }

    // Ensure we have a valid session before syncing
    const sessionOk = await ensureSession();
    if (!sessionOk) {
      console.log('[SEL] No session available, skipping sync');
      return;
    }

    // Combine all enabled rules into one SEL program
    const combinedCode = enabledRules
      .map(r => `# Rule: ${r.name}\n${r.selCode}`)
      .join('\n\n');

    try {
      const result = await selClient.storeRules(siteId, combinedCode);
      if (result.success) {
        console.log(`[SEL] Synced ${result.rules_count} rules to backend`);
      } else {
        console.error('[SEL] Failed to sync rules:', result.error);
      }
    } catch (err) {
      console.error('[SEL] Error syncing rules:', err);
    }
  }, [siteId, isDemoMode, ensureSession]);

  // Track if we've done the initial load (to skip auto-sync on mount)
  const initialLoadRef = useRef(true);

  // Sync rules when they change (only in real mode, skip initial load)
  useEffect(() => {
    // Skip sync on initial load - only sync when user makes changes
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    if (!isDemoMode && rules.length > 0) {
      syncRulesToBackend(rules);
    }
  }, [rules, syncRulesToBackend, isDemoMode]);

  // Process scheduler response and create logs (only in real mode)
  const processSchedulerResponse = useCallback((response: CheckSchedulesResponse) => {
    if (isDemoMode) return; // Don't log in demo mode
    if (!response.success) {
      console.error('[SEL] Schedule check failed:', response.error);
      return;
    }

    // Log triggered schedules
    for (const triggered of response.triggered_schedules) {
      const rule = rules.find(r => r.selCode.includes(triggered.rule_id));
      const newLog = addLog(siteId, {
        ruleId: triggered.rule_id,
        ruleName: rule?.name || triggered.rule_id,
        triggeredAt: new Date().toISOString(),
        message: `Schedule triggered: ${triggered.schedule_type}`,
        status: 'success',
      });
      setLogs(prev => [...prev, newLog]);
    }

    // Log dispatched actions
    for (const action of response.dispatched_actions) {
      const newLog = addLog(siteId, {
        ruleId: 'action',
        ruleName: action.action_type,
        triggeredAt: new Date().toISOString(),
        message: action.message,
        status: action.success ? 'success' : 'error',
      });
      setLogs(prev => [...prev, newLog]);
    }
  }, [rules, siteId, isDemoMode]);

  // Scheduler loop - checks scheduled rules periodically (only in real mode)
  // Only runs when we have a valid session (after user has signed for changes)
  useEffect(() => {
    // Don't run scheduler in demo mode or without session
    if (isDemoMode || !hasSession) {
      setSchedulerActive(false);
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
      return;
    }

    const enabledRules = rules.filter(r => r.enabled);

    // Only run scheduler if there are enabled rules
    if (enabledRules.length === 0) {
      setSchedulerActive(false);
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
      return;
    }

    setSchedulerActive(true);

    const checkSchedules = async () => {
      try {
        console.log('[SEL] Checking schedules for site:', siteId);
        const response = await selClient.checkSchedules(siteId);
        setLastCheck(new Date());
        processSchedulerResponse(response);

        if (response.triggered_schedules.length > 0) {
          console.log(`[SEL] Triggered ${response.triggered_schedules.length} schedules`);
        }
      } catch (err) {
        console.error('[SEL] Schedule check error:', err);
      }
    };

    // Run immediately on mount
    checkSchedules();

    // Then run periodically
    schedulerRef.current = window.setInterval(checkSchedules, SCHEDULER_INTERVAL);

    return () => {
      if (schedulerRef.current) {
        clearInterval(schedulerRef.current);
        schedulerRef.current = null;
      }
    };
  }, [siteId, rules, processSchedulerResponse, isDemoMode, hasSession]);

  // Handle opening editor for new rule
  const handleNewRule = () => {
    setEditorCode(NEW_RULE_TEMPLATE);
    setRuleName('');
    setEditingRule(null);
    setShowEditor(true);
    setAiError(null);
    setAiInput('');
  };

  // Handle AI prompt submission - enhances or generates based on existing code
  const handleAISubmit = async () => {
    if (!aiInput.trim()) return;

    setAiLoading(true);
    setAiError(null);

    // Build context: if there's existing non-template code, include it
    const existingCode = editorCode.trim();
    const hasRealCode = existingCode && !existingCode.startsWith('# My new automation rule');

    let prompt = aiInput;
    if (hasRealCode) {
      prompt = `Enhance or modify this existing SEL code based on the user request.\n\nExisting code:\n${existingCode}\n\nUser request: ${aiInput}`;
    }

    const response = await parseAutomationIntent(prompt);

    if (response.success && response.code) {
      setEditorCode(response.code);
      setAiInput('');
    } else {
      setAiError(response.error || 'Could not understand your request');
    }

    setAiLoading(false);
  };

  // Handle saving a rule (saveAsNew = true creates a copy instead of updating)
  const handleSaveRule = async (saveAsNew = false) => {
    if (!editorCode.trim()) return;

    setSaving(true);

    try {
      // Validate with backend (skip in demo mode for offline experience)
      if (!isDemoMode) {
        const validation = await selClient.validate(editorCode);
        if (!validation.valid) {
          setAiError(validation.error || 'Invalid SEL code');
          setSaving(false);
          return;
        }
      }

      // Use explicit name or fall back to first comment
      let finalName = ruleName.trim();
      if (!finalName) {
        const nameMatch = editorCode.match(/^#\s*(.+)$/m);
        finalName = nameMatch ? nameMatch[1].trim() : `Rule ${Date.now()}`;
      }

      if (editingRule && !saveAsNew) {
        // Update existing rule
        const updated = rules.map(r =>
          r.id === editingRule.id
            ? { ...r, selCode: editorCode, name: finalName, updatedAt: new Date().toISOString() }
            : r
        );
        if (!isDemoMode) {
          saveRules(siteId, updated);
        }
        setRules(updated);
      } else {
        // Create new rule (or save as new copy)
        const newRule: SELRule = {
          id: `sel_${Date.now()}`,
          name: saveAsNew ? `${finalName} (copy)` : finalName,
          siteId,
          selCode: editorCode,
          enabled: true,
          createdAt: new Date().toISOString(),
        };
        const updated = [...rules, newRule];
        if (!isDemoMode) {
          saveRules(siteId, updated);
        }
        setRules(updated);
      }

      // Close editor
      setShowEditor(false);
      setEditorCode('');
      setRuleName('');
      setEditingRule(null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  // Handle editing a rule
  const handleEditRule = (rule: SELRule) => {
    setEditorCode(rule.selCode);
    setRuleName(rule.name);
    setEditingRule(rule);
    setShowEditor(true);
    setAiError(null);
    setAiInput('');
  };

  // Handle toggling a rule
  const handleToggleRule = (ruleId: string) => {
    const updated = rules.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    if (!isDemoMode) {
      saveRules(siteId, updated);
    }
    setRules(updated);
  };

  // Handle deleting a rule
  const handleDeleteRule = (ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId);
    if (!isDemoMode) {
      saveRules(siteId, updated);
    }
    setRules(updated);
  };

  // Handle closing editor
  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditorCode('');
    setRuleName('');
    setEditingRule(null);
    setAiError(null);
    setAiInput('');
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
            <p className="text-gray-400 text-xs">
              {rules.filter(r => r.enabled).length} active rules
            </p>
          </div>
          {/* Scheduler status indicator */}
          {schedulerActive && (
            <div className="flex items-center gap-2 ml-4 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Activity className="w-3 h-3 text-green-400 animate-pulse" />
              <span className="text-green-400 text-xs">
                Engine running
                {lastCheck && (
                  <span className="text-green-400/60 ml-1">
                    (checked {Math.round((Date.now() - lastCheck.getTime()) / 1000)}s ago)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
        {!showEditor && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNewRule}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </motion.button>
        )}
      </div>

      {/* SEL Editor - Shows when creating or editing */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-gray-700/30 overflow-hidden"
          >
            <div className="p-4 bg-gradient-to-br from-cyan-900/20 to-blue-900/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span className="text-white text-sm font-medium">
                    {editingRule ? 'Edit Rule' : 'New Rule'}
                  </span>
                </div>
                <button
                  onClick={handleCloseEditor}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rule name input */}
              <div className="mb-3">
                <label className="block text-gray-400 text-xs mb-1">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Low battery alert"
                  className="w-full bg-gray-800/80 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none placeholder-gray-500"
                />
              </div>

              <SELEditor
                key={editorCode}
                initialCode={editorCode}
                onCompile={(code) => setEditorCode(code)}
                onError={(error) => setAiError(error)}
              />

              {/* AI Enhancement Section */}
              <div className="mt-4 p-3 bg-purple-900/20 border border-purple-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-200 text-sm font-medium">AI Assistant</span>
                  <span className="text-purple-400/60 text-xs">- Generate or enhance your rule</span>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {AI_SUGGESTIONS.slice(0, 4).map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAiInput(suggestion)}
                      className="px-2 py-1 bg-purple-800/30 text-purple-200 text-xs rounded-lg hover:bg-purple-700/40 hover:text-white transition-colors truncate max-w-[180px] border border-purple-500/20"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                {/* AI Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAISubmit()}
                    placeholder="Describe what you want, e.g., 'Alert me when battery drops below 20%'"
                    className="flex-1 bg-gray-800/80 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-400 focus:outline-none placeholder-gray-400"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAISubmit}
                    disabled={aiLoading || !aiInput.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-400 hover:to-pink-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {aiLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm font-medium">Generate</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Error display */}
              <AnimatePresence>
                {aiError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-red-300 text-sm">{aiError}</p>
                    <button onClick={() => setAiError(null)} className="ml-auto text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Save buttons */}
              <div className="mt-4 flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSaveRule(false)}
                  disabled={saving || !editorCode.trim()}
                  className="flex-1 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-lg hover:from-green-400 hover:to-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingRule ? 'Update' : 'Save Rule'}
                </motion.button>
                {editingRule && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSaveRule(true)}
                    disabled={saving || !editorCode.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Save as New
                  </motion.button>
                )}
                <button
                  onClick={handleCloseEditor}
                  className="px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Section */}
      <div>
        <button
          onClick={() => setExpandedSection(expandedSection === 'rules' ? null : 'rules')}
          className="w-full p-3 flex items-center justify-between text-gray-300 hover:bg-gray-800/30 transition-colors"
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
                <div className="p-6 text-center">
                  <Code2 className="w-10 h-10 mx-auto mb-3 text-cyan-400/30" />
                  <p className="text-gray-300">No automation rules yet.</p>
                  <p className="text-sm mt-1 text-gray-500">
                    Click "New Rule" above to create your first automation!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {rules.map((rule) => (
                    <div key={rule.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${rule.enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
                            <span className="text-white text-sm font-medium truncate">{rule.name}</span>
                          </div>
                          {/* Show first line of SEL code as preview */}
                          <p className="text-gray-400 text-xs font-mono truncate">
                            {rule.selCode.split('\n').find(l => l.trim() && !l.startsWith('#')) || rule.selCode.split('\n')[0]}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEditRule(rule)}
                            className="p-2 text-cyan-400 hover:bg-cyan-400/20 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleToggleRule(rule.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              rule.enabled
                                ? 'text-green-400 hover:bg-green-400/20'
                                : 'text-gray-500 hover:bg-gray-500/20'
                            }`}
                            title={rule.enabled ? 'Disable' : 'Enable'}
                          >
                            <Power className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-2 text-red-400 hover:bg-red-400/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
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
          className="w-full p-3 flex items-center justify-between text-gray-300 hover:bg-gray-800/30 transition-colors"
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
              className="overflow-hidden max-h-48 overflow-y-auto"
            >
              {logs.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No activity yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-700/30">
                  {logs.slice().reverse().map((log) => (
                    <div key={log.id} className="p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                          )}
                          <span className="text-white">{log.ruleName}</span>
                        </div>
                        <span className="text-gray-400">
                          {new Date(log.triggeredAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-400 mt-1">{log.message}</p>
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
