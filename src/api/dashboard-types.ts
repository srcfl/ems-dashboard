// Types for customizable dashboard layouts

export type WidgetType =
  | 'power-card-load'
  | 'power-card-solar'
  | 'power-card-battery'
  | 'power-card-grid'
  | 'chart'
  | 'automations'
  | 'battery-detail'
  | 'pv-detail'
  | 'meter-detail';

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large' | 'full';
}

export interface DashboardLayout {
  id: string;
  name: string;
  siteId: string;
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_WIDGETS: Widget[] = [
  { id: 'load', type: 'power-card-load', title: 'Load', enabled: true, order: 0, size: 'small' },
  { id: 'solar', type: 'power-card-solar', title: 'Solar', enabled: true, order: 1, size: 'small' },
  { id: 'battery', type: 'power-card-battery', title: 'Battery', enabled: true, order: 2, size: 'small' },
  { id: 'grid', type: 'power-card-grid', title: 'Grid', enabled: true, order: 3, size: 'small' },
  { id: 'chart', type: 'chart', title: 'Power Chart', enabled: true, order: 4, size: 'full' },
  { id: 'automations', type: 'automations', title: 'Automations', enabled: true, order: 5, size: 'full' },
  { id: 'battery-detail', type: 'battery-detail', title: 'Battery Details', enabled: true, order: 6, size: 'medium' },
  { id: 'pv-detail', type: 'pv-detail', title: 'Solar Details', enabled: true, order: 7, size: 'medium' },
  { id: 'meter-detail', type: 'meter-detail', title: 'Grid Meter', enabled: true, order: 8, size: 'medium' },
];

export const WIDGET_LABELS: Record<WidgetType, string> = {
  'power-card-load': 'Load Power Card',
  'power-card-solar': 'Solar Power Card',
  'power-card-battery': 'Battery Power Card',
  'power-card-grid': 'Grid Power Card',
  'chart': 'Power Chart',
  'automations': 'Automations Panel',
  'battery-detail': 'Battery Details',
  'pv-detail': 'Solar Details',
  'meter-detail': 'Grid Meter Details',
};

// Storage
const LAYOUT_STORAGE_KEY = 'ems_dashboard_layout';

export function loadLayout(siteId: string): DashboardLayout | null {
  try {
    const saved = localStorage.getItem(`${LAYOUT_STORAGE_KEY}_${siteId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveLayout(layout: DashboardLayout): void {
  localStorage.setItem(`${LAYOUT_STORAGE_KEY}_${layout.siteId}`, JSON.stringify(layout));
}

export function createDefaultLayout(siteId: string): DashboardLayout {
  return {
    id: `layout_${siteId}`,
    name: 'Default Layout',
    siteId,
    widgets: [...DEFAULT_WIDGETS],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getOrCreateLayout(siteId: string): DashboardLayout {
  const existing = loadLayout(siteId);
  if (existing) return existing;

  const newLayout = createDefaultLayout(siteId);
  saveLayout(newLayout);
  return newLayout;
}

export function updateWidgetOrder(layout: DashboardLayout, widgetId: string, newOrder: number): DashboardLayout {
  const widgets = [...layout.widgets];
  const widget = widgets.find(w => w.id === widgetId);
  if (!widget) return layout;

  const oldOrder = widget.order;

  // Update orders
  widgets.forEach(w => {
    if (w.id === widgetId) {
      w.order = newOrder;
    } else if (oldOrder < newOrder && w.order > oldOrder && w.order <= newOrder) {
      w.order--;
    } else if (oldOrder > newOrder && w.order >= newOrder && w.order < oldOrder) {
      w.order++;
    }
  });

  const updated = {
    ...layout,
    widgets: widgets.sort((a, b) => a.order - b.order),
    updatedAt: new Date().toISOString(),
  };

  saveLayout(updated);
  return updated;
}

export function toggleWidget(layout: DashboardLayout, widgetId: string): DashboardLayout {
  const updated = {
    ...layout,
    widgets: layout.widgets.map(w =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    ),
    updatedAt: new Date().toISOString(),
  };

  saveLayout(updated);
  return updated;
}

export function resetLayout(siteId: string): DashboardLayout {
  const newLayout = createDefaultLayout(siteId);
  saveLayout(newLayout);
  return newLayout;
}
