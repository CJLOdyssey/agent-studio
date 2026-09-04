import type { PerformanceTrendItem } from '../../../../../../api/client/cost';

/**
 * 颜色系统
 * - 主线条：蓝色
 * - SLO 线：橙色
 * - 状态色：红/绿（仅用于 Tooltip）
 */
const COLORS = {
  /** 主线条颜色 - 蓝色 */
  primary: '#3b82f6',
  /** 警告/SLO */
  warning: '#f59e0b',
  /** 成功/正常 */
  success: '#22c55e',
  /** 危险/错误 */
  danger: '#ef4444',
};

/**
 * 把后端 time_bucket 转成紧凑轴标签。
 * - hour 桶形如 "2024-01-01T13:00:00" → "01-02 13:00"
 * - day/week/month 桶形如 "2024-01-01" → "01-02"
 * 后端在收到用户 tz_offset_min 时已按用户本地时区切桶并返回"本地墙钟"标签，
 * 这里直接按固定格式切串，不再假定 UTC 二次 new Date(+8)（否则 hour 桶会再次漂移
 * 8 小时 / 跨到次日，正是"只有 23 个小时、没到 8 点"的根因之一）。
 */
function formatBucket(bucket: string): string {
  if (!bucket) return bucket;
  const isHour = bucket.includes('T');
  const datePart = isHour ? bucket.slice(0, 10) : bucket;
  const mm = datePart.slice(5, 7);
  const dd = datePart.slice(8, 10);
  if (!isHour) return `${mm}-${dd}`;
  const hh = bucket.slice(11, 13);
  return `${mm}-${dd} ${hh}:00`;
}

/**
 * 主题色（深色/浅色模式）
 */
function getThemeColors(isDark: boolean) {
  return {
    textColor: isDark ? '#9ca3af' : '#6b7280',
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    tooltipBg: isDark ? '#1f2937' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    tooltipText: isDark ? '#f3f4f6' : '#111827',
    /** 网格线颜色 */
    splitLine: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
  };
}

/**
 * 响应时间趋势图（大厂风格：Datadog/Grafana）
 *
 * 设计规范：
 * - 折线：细线（2px），平滑曲线
 * - 面积：半透明填充，渐变
 * - 网格：浅灰色虚线
 * - SLO 线：橙色虚线
 * - 无 markPoint（最大最小值）
 * - 无 toolbox（或仅保存图片）
 * - Hover 交互显示详情
 */
export function getResponseTimeOption(
  data: PerformanceTrendItem[],
  isDark: boolean,
) {
  if (data.length === 0) return null;
  const t = getThemeColors(isDark);

  return {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      textStyle: { color: t.tooltipText, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ECharts formatter 回调参数类型宽松，保留 any 简化
      formatter(params: any) {
        const idx = params[0]?.dataIndex ?? 0;
        const item = data[idx];
        const runs = (item?.runs ?? []).map(
          (r) =>
            `<div style="color:${t.textColor};padding-left:2px"><span style="font-family:monospace;color:${t.tooltipText}">${r.t}</span> · <span style="color:${t.textColor}">${r.dur.toFixed(1)}s</span></div>`,
        );
        return [
          `<div style="font-weight:600;margin-bottom:4px;color:${t.tooltipText}">${formatBucket(item.time_bucket)}</div>`,
          `<div style="color:${t.textColor}">平均响应 <b style="color:${t.tooltipText}">${item.avg_response_time_s.toFixed(2)}s</b></div>`,
          item.calls ? `<div style="color:${t.textColor}">调用次数 <b style="color:${t.tooltipText}">${item.calls}</b></div>` : '',
          runs.length ? `<div style="margin-top:4px;border-top:1px solid ${t.borderColor};padding-top:2px">${runs.join('')}</div>` : '',
        ].join('');
      },
    },
    /** 隐藏 toolbox，大厂风格不显示工具栏 */
    toolbox: { show: false },
    grid: {
      left: 50,
      right: 20,
      top: 30,
      bottom: 80,
    },
    legend: { show: false },
    dataZoom: [
      { type: 'inside' as const, start: 0, end: 100 },
      {
        type: 'slider' as const,
        height: 20,
        bottom: 8,
        borderColor: 'transparent',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        fillerColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        handleStyle: { color: COLORS.primary, borderColor: COLORS.primary },
        textStyle: { fontSize: 10, color: t.textColor },
        dataBackground: {
          lineStyle: { color: t.borderColor },
          areaStyle: { color: t.borderColor },
        },
      },
    ],
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => formatBucket(d.time_bucket)),
      axisLabel: {
        fontSize: 10,
        color: t.textColor,
        // 强制显示每一个本地小时标签（默认 auto 在 24 桶 + 容器宽度下会跳过末几格，正是
        // "轴只到 21:00、tooltip 23:00 仍孤悬"的根因）；斜 40° 避免横向重叠。
        interval: 0,
        hideOverlap: false,
        rotate: 40,
      },
      axisLine: { lineStyle: { color: t.borderColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: '响应时间 (s)',
      nameTextStyle: { fontSize: 10, color: t.textColor, padding: [0, 0, 0, 30] },
      axisLabel: { fontSize: 10, color: t.textColor, formatter: '{value}s' },
      splitLine: { lineStyle: { color: t.splitLine, type: 'dashed' as const } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: '平均响应时间',
        type: 'line' as const,
        data: data.map((d) => d.avg_response_time_s),
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: data.length <= 15 ? 6 : 0,
        showSymbol: data.length <= 15,
        lineStyle: { width: 2, color: COLORS.primary },
        itemStyle: { color: COLORS.primary, borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.2)' },
              { offset: 1, color: 'rgba(59,130,246,0.01)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: 3,
              name: 'SLO 目标',
              lineStyle: { color: COLORS.warning, type: 'dashed' as const, width: 1.5 },
              label: {
                formatter: 'SLO 3s',
                position: 'insideEndTop' as const,
                color: COLORS.warning,
                fontSize: 10,
              },
            },
          ],
        },
      },
    ],
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
  };
}

/**
 * 成功率趋势图（大厂风格）
 */
export function getSuccessRateOption(
  data: PerformanceTrendItem[],
  isDark: boolean,
) {
  if (data.length === 0) return null;
  const t = getThemeColors(isDark);

  return {
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: t.tooltipBg,
      borderColor: t.tooltipBorder,
      textStyle: { color: t.tooltipText, fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ECharts formatter 回调参数类型宽松，保留 any 简化
      formatter(params: any) {
        const idx = params[0]?.dataIndex ?? 0;
        const item = data[idx];
        const status = item.success_rate >= 95 ? '正常' : '告警';
        const statusColor = item.success_rate >= 95 ? COLORS.success : COLORS.danger;
        return [
          `<div style="font-weight:600;margin-bottom:4px;color:${t.tooltipText}">${formatBucket(item.time_bucket)}</div>`,
          `<div style="color:${t.textColor}">成功率 <b style="color:${t.tooltipText}">${item.success_rate.toFixed(1)}%</b></div>`,
          `<div style="color:${t.textColor}">调用次数 <b style="color:${t.tooltipText}">${item.calls}</b></div>`,
          `<div style="margin-top:4px;color:${statusColor}">${status}</div>`,
        ].join('');
      },
    },
    toolbox: { show: false },
    grid: {
      left: 50,
      right: 20,
      top: 30,
      bottom: 80,
    },
    legend: { show: false },
    dataZoom: [
      { type: 'inside' as const, start: 0, end: 100 },
      {
        type: 'slider' as const,
        height: 20,
        bottom: 8,
        borderColor: 'transparent',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        fillerColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        handleStyle: { color: COLORS.primary, borderColor: COLORS.primary },
        textStyle: { fontSize: 10, color: t.textColor },
        dataBackground: {
          lineStyle: { color: t.borderColor },
          areaStyle: { color: t.borderColor },
        },
      },
    ],
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => formatBucket(d.time_bucket)),
      axisLabel: {
        fontSize: 10,
        color: t.textColor,
        // 强制显示每一个本地小时标签（默认 auto 在 24 桶 + 容器宽度下会跳过末几格，正是
        // "轴只到 21:00、tooltip 23:00 仍孤悬"的根因）；斜 40° 避免横向重叠。
        interval: 0,
        hideOverlap: false,
        rotate: 40,
      },
      axisLine: { lineStyle: { color: t.borderColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      name: '成功率 (%)',
      nameTextStyle: { fontSize: 10, color: t.textColor, padding: [0, 0, 0, 30] },
      min: 80,
      max: 100,
      interval: 5,
      axisLabel: { fontSize: 10, color: t.textColor, formatter: '{value}%' },
      splitLine: { lineStyle: { color: t.splitLine, type: 'dashed' as const } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: '成功率',
        type: 'line' as const,
        data: data.map((d) => d.success_rate),
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: data.length <= 15 ? 6 : 0,
        showSymbol: data.length <= 15,
        lineStyle: { width: 2, color: COLORS.primary },
        itemStyle: { color: COLORS.primary, borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.2)' },
              { offset: 1, color: 'rgba(59,130,246,0.01)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: 95,
              name: 'SLO 目标',
              lineStyle: { color: COLORS.warning, type: 'dashed' as const, width: 1.5 },
              label: {
                formatter: 'SLO 95%',
                position: 'insideEndTop' as const,
                color: COLORS.warning,
                fontSize: 10,
              },
            },
          ],
        },
      },
    ],
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
  };
}
