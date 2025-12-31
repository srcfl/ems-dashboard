import type { ReactNode } from 'react';

interface PowerCardProps {
  title: string;
  icon: ReactNode;
  power: number;
  unit?: string;
  subtitle?: string;
  color: string;
  children?: ReactNode;
}

export function PowerCard({
  title,
  icon,
  power,
  unit = 'W',
  subtitle,
  color,
  children,
}: PowerCardProps) {
  const formatPower = (w: number) => {
    if (Math.abs(w) >= 1000) {
      return `${(w / 1000).toFixed(2)} kW`;
    }
    return `${w.toFixed(0)} ${unit}`;
  };

  return (
    <div className={`bg-gray-800 rounded-xl p-6 border-l-4 ${color}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">{icon}</div>
        <div>
          <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
          {subtitle && (
            <p className="text-gray-500 text-xs">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-2">
        {formatPower(power)}
      </div>
      {children}
    </div>
  );
}
