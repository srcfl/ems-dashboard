import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, XAXisComponentOption } from 'echarts';
import { getTimeSeries } from '../api/data-service';
import { useDataContext } from '../contexts/DataContext';

interface PowerChartProps {
  siteId: string;
  timeRange?: string;
}

interface ChartDataPoint {
  time: Date;
  load?: number;
  pv?: number;
  battery?: number;
  grid?: number;
  [key: string]: Date | number | undefined;
}

const COLORS = {
  load: '#F97316',
  pv: '#EAB308',
  battery: '#A855F7',
  grid: '#3B82F6',
};

const LABELS: Record<string, string> = {
  load: 'Load',
  pv: 'Solar',
  battery: 'Battery',
  grid: 'Grid',
};

export function PowerChart({ siteId, timeRange = '-1h' }: PowerChartProps) {
  const { credentials } = useDataContext();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<ReactECharts>(null);

  const getResolution = (range: string): string => {
    if (range.includes('7d')) return '1h';
    if (range.includes('24h')) return '15m';
    if (range.includes('6h')) return '5m';
    return '1m';
  };

  useEffect(() => {
    if (!credentials) return;

    setLoading(true);
    setError(null);

    const resolution = getResolution(timeRange);

    getTimeSeries(siteId, credentials, { start: timeRange, aggregate: resolution })
      .then((response) => {
        const grouped: Record<string, ChartDataPoint> = {};

        response.data.forEach((point) => {
          const time = new Date(point.timestamp);
          const key = time.toISOString();

          if (!grouped[key]) {
            grouped[key] = { time };
          }

          const derType = point.type || 'unknown';
          const current = (grouped[key][derType as keyof ChartDataPoint] as number) || 0;
          (grouped[key] as Record<string, unknown>)[derType] = current + (point.value || 0);
        });

        const sortedData = Object.values(grouped).sort(
          (a, b) => a.time.getTime() - b.time.getTime()
        );

        setData(sortedData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [siteId, timeRange, credentials]);

  const resetZoom = useCallback(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (chart) {
      chart.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100,
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800/30 rounded-2xl p-6 h-96 flex items-center justify-center border border-gray-700/30 backdrop-blur-xl">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-gray-400"
        >
          Loading chart...
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800/30 rounded-2xl p-6 h-96 flex items-center justify-center border border-gray-700/30 backdrop-blur-xl">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-800/30 rounded-2xl p-6 h-96 flex items-center justify-center border border-gray-700/30 backdrop-blur-xl">
        <div className="text-gray-400">No data available</div>
      </div>
    );
  }

  // Prepare series data
  const seriesKeys = ['load', 'pv', 'battery', 'grid'].filter(key =>
    data.some(d => d[key as keyof ChartDataPoint] !== undefined)
  );

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 1000,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderColor: 'rgba(55, 65, 81, 0.5)',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: '#E5E7EB',
        fontSize: 12,
      },
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.2)',
        },
        crossStyle: {
          color: 'rgba(255, 255, 255, 0.2)',
        },
      },
      formatter: (params: unknown) => {
        const arr = params as Array<{ seriesName: string; value: [Date, number]; color: string }>;
        if (!arr.length) return '';
        const time = new Date(arr[0].value[0]);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}`;
        let html = `<div style="font-weight: 500; margin-bottom: 8px; color: #9CA3AF;">${timeStr}</div>`;
        arr.forEach(item => {
          const value = item.value[1];
          const unit = Math.abs(value) >= 1000 ? 'kW' : 'W';
          const displayValue = Math.abs(value) >= 1000 ? (value / 1000).toFixed(2) : value.toFixed(0);
          html += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; box-shadow: 0 0 6px ${item.color};"></span>
            <span>${item.seriesName}</span>
            <span style="margin-left: auto; font-weight: 600;">${displayValue} ${unit}</span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      data: seriesKeys.map(key => LABELS[key]),
      top: 10,
      right: 20,
      textStyle: {
        color: '#9CA3AF',
        fontSize: 12,
      },
      itemWidth: 12,
      itemHeight: 12,
      icon: 'circle',
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Area Zoom',
            back: 'Reset Zoom',
          },
        },
        restore: {
          title: 'Reset',
        },
      },
      right: 20,
      top: 10,
      iconStyle: {
        borderColor: '#6B7280',
      },
      emphasis: {
        iconStyle: {
          borderColor: '#F59E0B',
        },
      },
    },
    grid: {
      left: 60,
      right: 20,
      top: 60,
      bottom: 80,
    },
    xAxis: {
      type: 'time',
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#6B7280',
        fontSize: 11,
        formatter: (value: number) => {
          const date = new Date(value);
          const pad = (n: number) => n.toString().padStart(2, '0');
          return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
        },
      },
      splitLine: {
        show: false,
      },
    } as XAXisComponentOption,
    yAxis: {
      type: 'value',
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: '#6B7280',
        fontSize: 11,
        formatter: (value: number) =>
          Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0),
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(55, 65, 81, 0.5)',
          type: 'dashed',
        },
      },
    },
    dataZoom: [
      // Slider at the bottom
      {
        type: 'slider',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        height: 30,
        bottom: 10,
        borderColor: 'rgba(55, 65, 81, 0.5)',
        backgroundColor: 'rgba(31, 41, 55, 0.5)',
        fillerColor: 'rgba(245, 158, 11, 0.2)',
        handleStyle: {
          color: '#F59E0B',
          borderColor: '#F59E0B',
        },
        moveHandleStyle: {
          color: '#F59E0B',
        },
        textStyle: {
          color: '#9CA3AF',
          fontSize: 10,
        },
        dataBackground: {
          lineStyle: {
            color: 'rgba(245, 158, 11, 0.5)',
          },
          areaStyle: {
            color: 'rgba(245, 158, 11, 0.1)',
          },
        },
        selectedDataBackground: {
          lineStyle: {
            color: '#F59E0B',
          },
          areaStyle: {
            color: 'rgba(245, 158, 11, 0.3)',
          },
        },
        brushSelect: true,
      },
      // Inside zoom (mouse wheel + drag)
      {
        type: 'inside',
        xAxisIndex: 0,
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
      },
    ],
    series: seriesKeys.map(key => ({
      name: LABELS[key],
      type: 'line',
      smooth: true,
      symbol: 'none',
      sampling: 'lttb',
      lineStyle: {
        width: 2,
        color: COLORS[key as keyof typeof COLORS],
        shadowColor: COLORS[key as keyof typeof COLORS],
        shadowBlur: 8,
        shadowOffsetY: 4,
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${COLORS[key as keyof typeof COLORS]}40` },
            { offset: 1, color: `${COLORS[key as keyof typeof COLORS]}00` },
          ],
        },
      },
      data: data.map(d => [d.time, d[key as keyof ChartDataPoint] || 0]),
    })),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-gray-800/30 rounded-2xl p-4 border border-gray-700/30 backdrop-blur-xl overflow-hidden"
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-2 relative z-10">
        <h3 className="text-gray-300 text-sm font-medium">Power Over Time</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Scroll to zoom</span>
          <span>|</span>
          <span>Drag to pan</span>
          <span>|</span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetZoom}
            className="text-amber-400 hover:text-amber-300"
          >
            Reset
          </motion.button>
        </div>
      </div>

      <div className="relative z-10">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: 350 }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
        />
      </div>
    </motion.div>
  );
}
