import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  Send,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import * as selClient from '../api/sel-client';

interface WebhookPanelProps {
  siteId: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  auth_type: 'none' | 'bearer' | 'basic' | 'api_key';
  auth_token?: string;
  events: string[];
  headers: Record<string, string>;
  last_success?: number;
  last_error?: string;
  failure_count: number;
}

interface WebhookDelivery {
  webhook_id: string;
  timestamp: number;
  url: string;
  request_body: string;
  response_status?: number;
  response_body?: string;
  success: boolean;
  error?: string;
  duration_ms: number;
}

const EVENT_OPTIONS = [
  { value: 'all', label: 'All Events' },
  { value: 'rule_triggered', label: 'Rule Triggered' },
  { value: 'schedule_triggered', label: 'Schedule Triggered' },
  { value: 'alert_high', label: 'High Alert' },
  { value: 'alert_low', label: 'Low Alert' },
];

const AUTH_TYPES = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api_key', label: 'API Key' },
];

export function WebhookPanel({ siteId }: WebhookPanelProps) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    auth_type: 'none' as const,
    auth_token: '',
    events: ['all'],
  });

  const fetchWebhooks = useCallback(async () => {
    try {
      const response = await selClient.listWebhooks(siteId);
      setWebhooks(response.webhooks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await selClient.getWebhookHistory(siteId);
      setDeliveries(response.deliveries || []);
    } catch (err) {
      console.error('Failed to fetch webhook history:', err);
    }
  }, [siteId]);

  useEffect(() => {
    fetchWebhooks();
    fetchHistory();
  }, [fetchWebhooks, fetchHistory]);

  const handleCreate = async () => {
    try {
      await selClient.createWebhook(siteId, {
        name: formData.name,
        url: formData.url,
        auth_type: formData.auth_type,
        auth_token: formData.auth_token || undefined,
        events: formData.events,
      });
      setIsAdding(false);
      resetForm();
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    }
  };

  const handleUpdate = async (webhookId: string) => {
    try {
      await selClient.updateWebhook(siteId, webhookId, {
        name: formData.name,
        url: formData.url,
        auth_type: formData.auth_type,
        auth_token: formData.auth_token || undefined,
        events: formData.events,
      });
      setEditingId(null);
      resetForm();
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await selClient.deleteWebhook(siteId, webhookId);
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleToggle = async (webhook: WebhookConfig) => {
    try {
      await selClient.updateWebhook(siteId, webhook.id, {
        enabled: !webhook.enabled,
      });
      fetchWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle webhook');
    }
  };

  const handleTest = async (webhookId: string) => {
    setTestingId(webhookId);
    try {
      const result = await selClient.testWebhook(siteId, webhookId);
      if (result.success) {
        alert(`Webhook test successful! Status: ${result.status_code}`);
      } else {
        alert(`Webhook test failed: ${result.message}\n${result.details || ''}`);
      }
      fetchWebhooks();
      fetchHistory();
    } catch (err) {
      alert(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTestingId(null);
    }
  };

  const startEdit = (webhook: WebhookConfig) => {
    setFormData({
      name: webhook.name,
      url: webhook.url,
      auth_type: webhook.auth_type,
      auth_token: webhook.auth_token || '',
      events: webhook.events,
    });
    setEditingId(webhook.id);
    setIsAdding(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      auth_type: 'none',
      auth_token: '',
      events: ['all'],
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading webhooks...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Webhooks</h3>
          <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-400">
            {webhooks.length}
          </span>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            resetForm();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Add/Edit Form */}
      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 space-y-4"
          >
            <h4 className="text-white font-medium">
              {editingId ? 'Edit Webhook' : 'New Webhook'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Webhook"
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Authentication</label>
                <select
                  value={formData.auth_type}
                  onChange={(e) => setFormData({ ...formData, auth_type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                >
                  {AUTH_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.auth_type !== 'none' && (
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    {formData.auth_type === 'bearer'
                      ? 'Bearer Token'
                      : formData.auth_type === 'basic'
                      ? 'Base64 Credentials'
                      : 'API Key'}
                  </label>
                  <input
                    type="password"
                    value={formData.auth_token}
                    onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })}
                    placeholder="Enter token..."
                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-gray-400 text-sm mb-1">Events</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((event) => (
                    <button
                      key={event.value}
                      onClick={() => {
                        const events = formData.events.includes(event.value)
                          ? formData.events.filter((e) => e !== event.value)
                          : [...formData.events, event.value];
                        setFormData({ ...formData, events: events.length ? events : ['all'] });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        formData.events.includes(event.value)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                          : 'bg-gray-700 text-gray-400 border border-transparent hover:border-gray-600'
                      }`}
                    >
                      {event.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => (editingId ? handleUpdate(editingId) : handleCreate())}
                disabled={!formData.name || !formData.url}
                className="px-4 py-2 bg-amber-500 text-gray-900 rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? 'Save Changes' : 'Create Webhook'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="bg-gray-800/30 rounded-xl p-8 text-center border border-gray-700/30">
            <Webhook className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No webhooks configured</p>
            <p className="text-gray-500 text-sm mt-1">
              Add a webhook to receive notifications when rules trigger
            </p>
          </div>
        ) : (
          webhooks.map((webhook) => (
            <motion.div
              key={webhook.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-gray-800/50 rounded-xl p-4 border transition-colors ${
                webhook.enabled ? 'border-gray-700/50' : 'border-gray-700/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        webhook.enabled
                          ? webhook.failure_count > 0
                            ? 'bg-yellow-400'
                            : 'bg-green-400'
                          : 'bg-gray-500'
                      }`}
                    />
                    <h4 className="text-white font-medium truncate">{webhook.name}</h4>
                    {webhook.failure_count > 0 && (
                      <span className="flex items-center gap-1 text-yellow-400 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        {webhook.failure_count} failures
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm truncate mt-1">{webhook.url}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400"
                      >
                        {event}
                      </span>
                    ))}
                    {webhook.auth_type !== 'none' && (
                      <span className="px-2 py-0.5 bg-purple-900/50 text-purple-400 rounded text-xs">
                        {webhook.auth_type}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(webhook.id)}
                    disabled={testingId === webhook.id}
                    className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
                    title="Test webhook"
                  >
                    {testingId === webhook.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(webhook)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(webhook)}
                    className={`p-2 transition-colors ${
                      webhook.enabled
                        ? 'text-green-400 hover:text-green-300'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                    title={webhook.enabled ? 'Disable' : 'Enable'}
                  >
                    {webhook.enabled ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {webhook.last_error && (
                <div className="mt-3 p-2 bg-red-900/20 rounded text-red-400 text-xs">
                  Last error: {webhook.last_error}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Delivery History */}
      {webhooks.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Clock className="w-4 h-4" />
            <span>Delivery History</span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="text-xs text-gray-500">({deliveries.length})</span>
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2 max-h-64 overflow-y-auto"
              >
                {deliveries.length === 0 ? (
                  <p className="text-gray-500 text-sm">No deliveries yet</p>
                ) : (
                  deliveries
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((delivery, idx) => (
                      <div
                        key={`${delivery.webhook_id}-${delivery.timestamp}-${idx}`}
                        className={`p-3 rounded-lg text-sm ${
                          delivery.success
                            ? 'bg-green-900/20 border border-green-500/20'
                            : 'bg-red-900/20 border border-red-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {delivery.success ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                            <span className={delivery.success ? 'text-green-400' : 'text-red-400'}>
                              {delivery.response_status || 'Error'}
                            </span>
                            <span className="text-gray-500">{delivery.duration_ms}ms</span>
                          </div>
                          <span className="text-gray-500 text-xs">
                            {new Date(delivery.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 text-gray-400 truncate flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {delivery.url}
                        </div>
                        {delivery.error && (
                          <div className="mt-1 text-red-400 text-xs">{delivery.error}</div>
                        )}
                      </div>
                    ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
