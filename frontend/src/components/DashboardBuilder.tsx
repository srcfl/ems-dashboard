import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GripVertical,
  X,
  Plus,
  LayoutGrid,
  Save,
  RotateCcw,
  Settings2,
  Sun,
  Battery,
  Plug,
  Home,
  Activity,
  LineChart,
  Bell,
  Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// Widget types
export type WidgetType =
  | 'pv_power'
  | 'battery_power'
  | 'grid_power'
  | 'load_power'
  | 'battery_soc'
  | 'chart'
  | 'automations'
  | 'der_cards'
  | 'data_quality';

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  visible: boolean;
}

interface WidgetConfig {
  type: WidgetType;
  title: string;
  icon: React.ReactNode;
  defaultSize: Widget['size'];
  description: string;
}

const WIDGET_CONFIGS: WidgetConfig[] = [
  { type: 'pv_power', title: 'Solar Power', icon: <Sun className="w-4 h-4" />, defaultSize: 'small', description: 'Current solar production' },
  { type: 'battery_power', title: 'Battery Power', icon: <Battery className="w-4 h-4" />, defaultSize: 'small', description: 'Battery charge/discharge' },
  { type: 'grid_power', title: 'Grid Power', icon: <Plug className="w-4 h-4" />, defaultSize: 'small', description: 'Grid import/export' },
  { type: 'load_power', title: 'Load Power', icon: <Home className="w-4 h-4" />, defaultSize: 'small', description: 'House consumption' },
  { type: 'battery_soc', title: 'Battery SoC', icon: <Gauge className="w-4 h-4" />, defaultSize: 'small', description: 'State of charge' },
  { type: 'chart', title: 'Power Chart', icon: <LineChart className="w-4 h-4" />, defaultSize: 'full', description: 'Time series chart' },
  { type: 'automations', title: 'Automations', icon: <Bell className="w-4 h-4" />, defaultSize: 'large', description: 'Automation rules' },
  { type: 'der_cards', title: 'DER Cards', icon: <Activity className="w-4 h-4" />, defaultSize: 'full', description: 'Device details' },
  { type: 'data_quality', title: 'Data Quality', icon: <Settings2 className="w-4 h-4" />, defaultSize: 'medium', description: 'Data statistics' },
];

const SIZE_CLASSES = {
  small: 'col-span-1',
  medium: 'col-span-2',
  large: 'col-span-3',
  full: 'col-span-4',
};

// Default layout
const DEFAULT_WIDGETS: Widget[] = [
  { id: 'load-1', type: 'load_power', title: 'Load', size: 'small', visible: true },
  { id: 'pv-1', type: 'pv_power', title: 'Solar', size: 'small', visible: true },
  { id: 'battery-1', type: 'battery_power', title: 'Battery', size: 'small', visible: true },
  { id: 'grid-1', type: 'grid_power', title: 'Grid', size: 'small', visible: true },
  { id: 'chart-1', type: 'chart', title: 'Power Over Time', size: 'full', visible: true },
  { id: 'automations-1', type: 'automations', title: 'Automations', size: 'full', visible: true },
  { id: 'der-1', type: 'der_cards', title: 'Devices', size: 'full', visible: true },
];

const STORAGE_KEY = 'dashboard-layout';

// Sortable Widget Item
function SortableWidget({
  widget,
  isEditMode,
  onRemove,
  onSizeChange,
  children,
}: {
  widget: Widget;
  isEditMode: boolean;
  onRemove: (id: string) => void;
  onSizeChange: (id: string, size: Widget['size']) => void;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sizes: Widget['size'][] = ['small', 'medium', 'large', 'full'];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        SIZE_CLASSES[widget.size],
        'relative group',
        isDragging && 'z-50 opacity-80'
      )}
    >
      {/* Edit mode overlay */}
      {isEditMode && (
        <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-purple-500/50 bg-purple-500/5 pointer-events-none" />
      )}

      {/* Drag handle & controls */}
      {isEditMode && (
        <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1">
          {/* Size selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 bg-gray-800 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors">
                <LayoutGrid className="w-3 h-3 text-gray-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-800 border-gray-700">
              {sizes.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => onSizeChange(widget.id, size)}
                  className={cn(
                    'text-gray-300 hover:text-white cursor-pointer',
                    widget.size === size && 'bg-purple-500/20 text-purple-400'
                  )}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Remove button */}
          <button
            onClick={() => onRemove(widget.id)}
            className="p-1.5 bg-red-500/20 rounded-lg border border-red-500/50 hover:bg-red-500/30 transition-colors"
          >
            <X className="w-3 h-3 text-red-400" />
          </button>

          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1.5 bg-gray-800 rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      )}

      {children}
    </motion.div>
  );
}

// Add Widget Dialog
function AddWidgetDialog({
  onAdd,
  existingTypes,
}: {
  onAdd: (type: WidgetType) => void;
  existingTypes: WidgetType[];
}) {
  const [open, setOpen] = useState(false);

  const availableWidgets = WIDGET_CONFIGS.filter(
    (config) => !existingTypes.includes(config.type)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Widget
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add Widget</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 mt-4">
          {availableWidgets.length === 0 ? (
            <p className="text-gray-400 text-center py-4">
              All widgets are already added
            </p>
          ) : (
            availableWidgets.map((config) => (
              <button
                key={config.type}
                onClick={() => {
                  onAdd(config.type);
                  setOpen(false);
                }}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  {config.icon}
                </div>
                <div>
                  <p className="text-white font-medium">{config.title}</p>
                  <p className="text-gray-400 text-sm">{config.description}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Dashboard Builder
interface DashboardBuilderProps {
  renderWidget: (widget: Widget) => React.ReactNode;
}

export function DashboardBuilder({ renderWidget }: DashboardBuilderProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_WIDGETS;
      }
    }
    return DEFAULT_WIDGETS;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleRemove = useCallback((id: string) => {
    setWidgets((items) => items.filter((item) => item.id !== id));
  }, []);

  const handleSizeChange = useCallback((id: string, size: Widget['size']) => {
    setWidgets((items) =>
      items.map((item) => (item.id === id ? { ...item, size } : item))
    );
  }, []);

  const handleAdd = useCallback((type: WidgetType) => {
    const config = WIDGET_CONFIGS.find((c) => c.type === type);
    if (!config) return;

    const newWidget: Widget = {
      id: `${type}-${Date.now()}`,
      type,
      title: config.title,
      size: config.defaultSize,
      visible: true,
    };
    setWidgets((items) => [...items, newWidget]);
  }, []);

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    setIsEditMode(false);
  }, [widgets]);

  const handleReset = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const visibleWidgets = widgets.filter((w) => w.visible);
  const existingTypes = widgets.map((w) => w.type);

  return (
    <div className="space-y-4">
      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={isEditMode}
              onCheckedChange={setIsEditMode}
              className="data-[state=checked]:bg-purple-500"
            />
            <span className="text-sm text-gray-400">
              {isEditMode ? 'Edit Mode' : 'View Mode'}
            </span>
          </div>
        </div>

        <AnimatePresence>
          {isEditMode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-2"
            >
              <AddWidgetDialog onAdd={handleAdd} existingTypes={existingTypes} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-gray-800 border-gray-600">
                    <Settings2 className="w-4 h-4 mr-2" />
                    Options
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-700">
                  <DropdownMenuItem
                    onClick={handleReset}
                    className="text-gray-300 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Default
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handleSave}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Layout
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Widget Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleWidgets} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {visibleWidgets.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  isEditMode={isEditMode}
                  onRemove={handleRemove}
                  onSizeChange={handleSizeChange}
                >
                  {renderWidget(widget)}
                </SortableWidget>
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {visibleWidgets.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No widgets added yet</p>
          <p className="text-sm mt-2">
            Enable edit mode and click "Add Widget" to get started
          </p>
        </div>
      )}
    </div>
  );
}

export { WIDGET_CONFIGS, DEFAULT_WIDGETS };
