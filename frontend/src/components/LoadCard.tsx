import { Home } from 'lucide-react';

interface LoadCardProps {
  loadW: number;
}

export function LoadCard({ loadW }: LoadCardProps) {
  const formatPower = (w: number) => {
    if (Math.abs(w) >= 1000) {
      return `${(w / 1000).toFixed(2)} kW`;
    }
    return `${Math.abs(w).toFixed(0)} W`;
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-orange-500">
      <div className="flex items-center gap-3 mb-4">
        <Home className="w-8 h-8 text-orange-400" />
        <div>
          <h3 className="text-gray-400 text-sm font-medium">Load</h3>
          <p className="text-gray-500 text-xs">Total Consumption</p>
        </div>
      </div>

      <div className="text-3xl font-bold text-white">
        {formatPower(loadW)}
      </div>
    </div>
  );
}
