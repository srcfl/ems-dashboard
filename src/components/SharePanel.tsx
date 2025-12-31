import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Link,
  Copy,
  Check,
  Trash2,
  Clock,
  Eye,
  X,
  ExternalLink,
} from 'lucide-react';
import type { SharedDashboard, ExpirationPeriod } from '../api/share-types';
import {
  EXPIRATION_LABELS,
  loadShares,
  createShare,
  deleteShare,
  getShareUrl,
  formatTimeRemaining,
  isShareExpired,
} from '../api/share-types';

interface SharePanelProps {
  siteId: string;
  siteName: string;
  timeRange: string;
}

export function SharePanel({ siteId, siteName, timeRange }: SharePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shares, setShares] = useState<SharedDashboard[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expiration, setExpiration] = useState<ExpirationPeriod>('7d');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDerCards, setShowDerCards] = useState(true);
  const [showAutomations, setShowAutomations] = useState(false);

  useEffect(() => {
    setShares(loadShares().filter(s => s.siteId === siteId));
  }, [siteId, isOpen]);

  const handleCreateShare = () => {
    const share = createShare(siteId, siteName, 'demo-user', expiration, {
      timeRange,
      showDerCards,
      showAutomations,
    });
    setShares([...shares, share]);
    setShowCreateForm(false);
    handleCopyLink(share.id);
  };

  const handleDeleteShare = (shareId: string) => {
    deleteShare(shareId);
    setShares(shares.filter(s => s.id !== shareId));
  };

  const handleCopyLink = async (shareId: string) => {
    const url = getShareUrl(shareId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const activeShares = shares.filter(s => !isShareExpired(s));
  const expiredShares = shares.filter(s => isShareExpired(s));

  return (
    <>
      {/* Share Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Share
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl border border-gray-700/50 w-full max-w-lg max-h-[80vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Share2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Share Dashboard</h3>
                    <p className="text-gray-500 text-xs">{siteName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {/* Create New Share */}
                {!showCreateForm ? (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setShowCreateForm(true)}
                    className="w-full p-4 border-2 border-dashed border-gray-700 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors flex items-center justify-center gap-2 text-gray-400 hover:text-blue-400"
                  >
                    <Link className="w-5 h-5" />
                    <span>Create Shareable Link</span>
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-gray-800/50 rounded-xl p-4 mb-4"
                  >
                    <h4 className="text-white font-medium mb-4">Create New Link</h4>

                    {/* Expiration */}
                    <div className="mb-4">
                      <label className="block text-gray-400 text-sm mb-2">
                        Link Expires In
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(EXPIRATION_LABELS) as ExpirationPeriod[]).map(
                          (period) => (
                            <button
                              key={period}
                              onClick={() => setExpiration(period)}
                              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                expiration === period
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {EXPIRATION_LABELS[period]}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="mb-4 space-y-2">
                      <label className="block text-gray-400 text-sm mb-2">
                        Include in Share
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showDerCards}
                          onChange={(e) => setShowDerCards(e.target.checked)}
                          className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                        />
                        DER Detail Cards
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAutomations}
                          onChange={(e) => setShowAutomations(e.target.checked)}
                          className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                        />
                        Automations Panel
                      </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreateShare}
                        className="flex-1 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-400 transition-colors"
                      >
                        Create & Copy Link
                      </motion.button>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Active Shares */}
                {activeShares.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-gray-400 text-sm font-medium mb-3">
                      Active Links ({activeShares.length})
                    </h4>
                    <div className="space-y-2">
                      {activeShares.map((share) => (
                        <motion.div
                          key={share.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-800/50 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              <span className="text-white text-sm truncate">
                                {getShareUrl(share.id)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeRemaining(share.expiresAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {share.accessCount} views
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleCopyLink(share.id)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                              title="Copy link"
                            >
                              {copiedId === share.id ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => window.open(getShareUrl(share.id), '_blank')}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                              title="Open link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDeleteShare(share.id)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Delete link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expired Shares */}
                {expiredShares.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-gray-500 text-sm font-medium mb-3">
                      Expired Links ({expiredShares.length})
                    </h4>
                    <div className="space-y-2 opacity-60">
                      {expiredShares.map((share) => (
                        <div
                          key={share.id}
                          className="bg-gray-800/30 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Link className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-gray-500 text-sm truncate line-through">
                                {getShareUrl(share.id)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                              <span>Expired</span>
                              <span>{share.accessCount} total views</span>
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteShare(share.id)}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {shares.length === 0 && !showCreateForm && (
                  <div className="mt-4 text-center text-gray-500 text-sm py-8">
                    <Share2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No shared links yet.</p>
                    <p className="text-xs mt-1">Create one to share your dashboard!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
