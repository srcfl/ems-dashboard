import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import SELEditor from './SELEditor';
import { parseAutomationIntent, AI_SUGGESTIONS } from '../api/ai-automation';
import { selClient } from '../api/sel-client';

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
}

const STORAGE_KEY = 'ems_sel_rules';
const LOG_STORAGE_KEY = 'ems_automation_logs';

function loadRules(): SELRule[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRules(rules: SELRule[]): void {
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

// Default template for new rules
const NEW_RULE_TEMPLATE = `# My new automation rule
# Describe what this rule should do

# Example: Alert when battery is low
# ON battery_soc < 20%
#   NOTIFY "Battery low: {battery_soc}%"
#   COOLDOWN 15min
`;

export function AutomationPanel({ siteId }: AutomationPanelProps) {
  const [rules, setRules] = useState<SELRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [expandedSection, setExpandedSection] = useState<'rules' | 'logs' | null>('rules');

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

  useEffect(() => {
    setRules(loadRules().filter(r => r.siteId === siteId));
    setLogs(loadLogs().filter(l => rules.some(r => r.id === l.ruleId)));
  }, [siteId]);

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
      // Validate with backend
      const validation = await selClient.validate(editorCode);
      if (!validation.valid) {
        setAiError(validation.error || 'Invalid SEL code');
        setSaving(false);
        return;
      }

      // Use explicit name or fall back to first comment
      let finalName = ruleName.trim();
      if (!finalName) {
        const nameMatch = editorCode.match(/^#\s*(.+)$/m);
        finalName = nameMatch ? nameMatch[1].trim() : `Rule ${Date.now()}`;
      }

      if (editingRule && !saveAsNew) {
        // Update existing rule
        const allRules = loadRules();
        const updated = allRules.map(r =>
          r.id === editingRule.id
            ? { ...r, selCode: editorCode, name: finalName, updatedAt: new Date().toISOString() }
            : r
        );
        saveRules(updated);
        setRules(updated.filter(r => r.siteId === siteId));
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
        const allRules = [...loadRules(), newRule];
        saveRules(allRules);
        setRules(allRules.filter(r => r.siteId === siteId));
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
    const allRules = loadRules();
    const updated = allRules.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    saveRules(updated);
    setRules(updated.filter(r => r.siteId === siteId));
  };

  // Handle deleting a rule
  const handleDeleteRule = (ruleId: string) => {
    const allRules = loadRules().filter(r => r.id !== ruleId);
    saveRules(allRules);
    setRules(allRules.filter(r => r.siteId === siteId));
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
