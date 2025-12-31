import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, RotateCcw, Unlock, ChevronUp, ChevronDown } from 'lucide-react';

export interface DashboardWidget {
  id: string;
  title: string;
  component: ReactNode;
  defaultLayout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    maxW?: number;
    maxH?: number;
  };
}

interface DashboardLayoutProps {
  widgets: DashboardWidget[];
  storageKey: string;
  columns?: number;
  rowHeight?: number;
}

export function DashboardLayout({
  widgets,
  storageKey,
}: DashboardLayoutProps) {
  // Load widget order from localStorage
  const loadOrder = useCallback((): string[] => {
    try {
      const saved = localStorage.getItem(`dashboard_order_${storageKey}`);
      if (saved) {
        const order = JSON.parse(saved);
        // Ensure all widget IDs are in the order
        const widgetIds = widgets.map(w => w.id);
        const validOrder = order.filter((id: string) => widgetIds.includes(id));
        const missingIds = widgetIds.filter(id => !validOrder.includes(id));
        return [...validOrder, ...missingIds];
      }
    } catch (e) {
      console.warn('Failed to load dashboard order:', e);
    }
    return widgets.map(w => w.id);
  }, [storageKey, widgets]);

  const [widgetOrder, setWidgetOrder] = useState<string[]>(loadOrder);
  const [isEditing, setIsEditing] = useState(false);
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`dashboard_hidden_${storageKey}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Save order to localStorage
  const saveOrder = useCallback((newOrder: string[]) => {
    try {
      localStorage.setItem(`dashboard_order_${storageKey}`, JSON.stringify(newOrder));
    } catch (e) {
      console.warn('Failed to save dashboard order:', e);
    }
  }, [storageKey]);

  // Save hidden widgets
  const saveHiddenWidgets = useCallback((hidden: Set<string>) => {
    try {
      localStorage.setItem(`dashboard_hidden_${storageKey}`, JSON.stringify([...hidden]));
    } catch (e) {
      console.warn('Failed to save hidden widgets:', e);
    }
  }, [storageKey]);

  // Move widget up/down
  const moveWidget = useCallback((widgetId: string, direction: 'up' | 'down') => {
    setWidgetOrder(prev => {
      const visibleOrder = prev.filter(id => !hiddenWidgets.has(id));
      const currentIndex = visibleOrder.indexOf(widgetId);
      if (currentIndex === -1) return prev;
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= visibleOrder.length) return prev;
      const newVisibleOrder = [...visibleOrder];
      [newVisibleOrder[currentIndex], newVisibleOrder[newIndex]] =
        [newVisibleOrder[newIndex], newVisibleOrder[currentIndex]];
      const hiddenOrder = prev.filter(id => hiddenWidgets.has(id));
      const newOrder = [...newVisibleOrder, ...hiddenOrder];
      saveOrder(newOrder);
      return newOrder;
    });
  }, [hiddenWidgets, saveOrder]);

  // Reset to default order
  const resetLayout = useCallback(() => {
    const defaultOrder = widgets.map(w => w.id);
    setWidgetOrder(defaultOrder);
    saveOrder(defaultOrder);
    setHiddenWidgets(new Set());
    saveHiddenWidgets(new Set());
  }, [widgets, saveOrder, saveHiddenWidgets]);

  // Toggle widget visibility
  const toggleWidget = useCallback((widgetId: string) => {
    setHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }
      saveHiddenWidgets(next);
      return next;
    });
  }, [saveHiddenWidgets]);

  // Get ordered and visible widgets
  const orderedWidgets = widgetOrder
    .map(id => widgets.find(w => w.id === id))
    .filter((w): w is DashboardWidget => w !== undefined && !hiddenWidgets.has(w.id));

  return (
    <div className="relative">
      {/* Edit Mode Toggle - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-20 flex items-center gap-2">
        <AnimatePresence>
          {isEditing && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={resetLayout}
              className="p-2 bg-gray-800/80 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-white transition-colors border border-gray-700/50 backdrop-blur-sm flex items-center gap-2 text-sm"
              title="Reset to default layout"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </motion.button>
          )}
        </AnimatePresence>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsEditing(!isEditing)}
          className={`p-2 rounded-lg transition-colors border backdrop-blur-sm flex items-center gap-2 ${
            isEditing
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
              : 'bg-gray-800/80 text-gray-400 border-gray-700/50 hover:bg-gray-700 hover:text-white'
          }`}
          title={isEditing ? 'Lock layout' : 'Edit layout'}
        >
          {isEditing ? (
            <>
              <Unlock className="w-4 h-4" />
              <span className="text-sm">Done</span>
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              <span className="text-sm">Edit</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Widget Visibility Panel (shown in edit mode) */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">Dashboard Widgets</span>
              <span className="text-xs text-gray-500">- Use arrows to reorder, click to toggle visibility</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {widgets.map((widget) => {
                const isHidden = hiddenWidgets.has(widget.id);
                return (
                  <button
                    key={widget.id}
                    onClick={() => toggleWidget(widget.id)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                      isHidden
                        ? 'bg-gray-700/30 text-gray-500 border border-gray-600/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isHidden ? '+ ' : '✓ '}
                    {widget.title}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget List */}
      <div className="space-y-4">
        {orderedWidgets.map((widget, index) => (
          <motion.div
            key={widget.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative ${isEditing ? 'ring-2 ring-amber-500/30 ring-offset-2 ring-offset-gray-900 rounded-xl' : ''}`}
          >
            {/* Reorder Controls (shown in edit mode) */}
            {isEditing && (
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                <button
                  onClick={() => moveWidget(widget.id, 'up')}
                  disabled={index === 0}
                  className="p-1 bg-gray-800/80 text-gray-400 rounded hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-700/50"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveWidget(widget.id, 'down')}
                  disabled={index === orderedWidgets.length - 1}
                  className="p-1 bg-gray-800/80 text-gray-400 rounded hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-700/50"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
            {widget.component}
          </motion.div>
        ))}
      </div>

      {/* Edit mode overlay hint */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-500/90 text-black text-sm font-medium rounded-full shadow-lg z-50"
          >
            Use arrows to reorder • Click widgets to show/hide • Click "Done" when finished
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
