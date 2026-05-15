<template>
  <div
    class="rounded-xl border flex flex-col overflow-hidden"
    :class="isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'"
  >
    <div class="px-4 py-3 border-b shrink-0 flex items-center justify-between" :class="isDark ? 'border-slate-800' : 'border-slate-100'">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
          BTC Price
        </span>
        <span v-if="latestPrice > 0" class="font-mono text-xs font-medium" :class="isDark ? 'text-cyan-400' : 'text-cyan-600'">
          {{ formatUSD(latestPrice) }}
        </span>
      </div>
      <span class="text-xs" :class="isDark ? 'text-slate-600' : 'text-slate-400'">
        {{ store.timeRange }}m window · {{ store.priceChartData.length }} pts
      </span>
    </div>
    <div class="flex-1 min-h-0 p-2">
      <v-chart
        v-if="store.priceChartData.length > 0"
        :option="chartOption"
        :theme="isDark ? 'dark' : undefined"
        autoresize
        class="w-full h-full"
        style="min-height: 180px"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center"
        style="min-height: 180px"
        :class="isDark ? 'text-slate-600' : 'text-slate-400'"
      >
        <div class="text-center">
          <div class="text-2xl mb-2">📈</div>
          <p class="text-xs">Waiting for price data…</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWhaleStore } from "@/stores/whaleStore";
import { formatUSD } from "@/utils/formatters";

const props = defineProps<{ isDark?: boolean }>();
const store = useWhaleStore();

const latestPrice = computed(() => store.stats.currentPrice);

const chartOption = computed(() => {
  const data = store.priceChartData as [number, number][];
  const prices = data.map((d) => d[1]);
  const minPrice = Math.min(...prices) * 0.9995;
  const maxPrice = Math.max(...prices) * 1.0005;

  const bg = props.isDark ? "#0f172a" : "#ffffff";
  const textColor = props.isDark ? "#64748b" : "#94a3b8";
  const lineColor = "#06b6d4";
  const areaTop = props.isDark ? "rgba(6,182,212,0.25)" : "rgba(6,182,212,0.15)";
  const areaBottom = "rgba(6,182,212,0)";
  const splitLineColor = props.isDark ? "#1e293b" : "#f1f5f9";

  return {
    backgroundColor: "transparent",
    animation: false,
    grid: { left: 10, right: 12, top: 8, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: props.isDark ? "#1e293b" : "#ffffff",
      borderColor: props.isDark ? "#334155" : "#e2e8f0",
      textStyle: { color: props.isDark ? "#e2e8f0" : "#1e293b", fontSize: 11 },
      formatter: (params: unknown[]) => {
        const p = (params as { value: [number, number] }[])[0];
        if (!p) return "";
        const time = new Date(p.value[0]).toLocaleTimeString("en-US", { hour12: false });
        return `<span style="font-size:10px;color:${textColor}">${time}</span><br/><b style="font-family:monospace">${formatUSD(p.value[1])}</b>`;
      },
    },
    xAxis: {
      type: "time",
      axisLabel: {
        color: textColor,
        fontSize: 10,
        formatter: (val: number) =>
          new Date(val).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      },
      axisLine: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: minPrice,
      max: maxPrice,
      scale: true,
      axisLabel: {
        color: textColor,
        fontSize: 10,
        formatter: (val: number) => `$${(val / 1000).toFixed(1)}K`,
      },
      splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
    },
    series: [
      {
        type: "line",
        data,
        smooth: 0.3,
        symbol: "none",
        lineStyle: { color: lineColor, width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: areaTop },
              { offset: 1, color: areaBottom },
            ],
          },
        },
        emphasis: { disabled: true },
      },
    ],
  };
});
</script>
