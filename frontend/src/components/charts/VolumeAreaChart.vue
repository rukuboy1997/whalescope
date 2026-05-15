<template>
  <div
    class="rounded-xl border flex flex-col overflow-hidden"
    :class="isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'"
  >
    <div
      class="px-4 py-3 border-b shrink-0 flex items-center justify-between"
      :class="isDark ? 'border-slate-800' : 'border-slate-100'"
    >
      <span class="text-sm font-semibold" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
        Long vs Short Volume
      </span>
      <div class="flex items-center gap-3 text-xs">
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span :class="isDark ? 'text-slate-400' : 'text-slate-500'">Long</span>
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-red-400 inline-block" />
          <span :class="isDark ? 'text-slate-400' : 'text-slate-500'">Short</span>
        </span>
      </div>
    </div>
    <div class="flex-1 min-h-0 p-2">
      <v-chart
        v-if="hasData"
        :option="chartOption"
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
          <div class="text-2xl mb-2">📊</div>
          <p class="text-xs">No volume data yet…</p>
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

const hasData = computed(() => store.timeBuckets.some((b) => b.count > 0));

const chartOption = computed(() => {
  const buckets = store.timeBuckets;
  const labels = buckets.map((b) => b.label);
  const longData = buckets.map((b) => b.longVolume);
  const shortData = buckets.map((b) => b.shortVolume);

  const textColor = props.isDark ? "#64748b" : "#94a3b8";
  const splitLineColor = props.isDark ? "#1e293b" : "#f1f5f9";

  return {
    backgroundColor: "transparent",
    animation: true,
    animationDuration: 300,
    grid: { left: 10, right: 12, top: 8, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: props.isDark ? "#1e293b" : "#ffffff",
      borderColor: props.isDark ? "#334155" : "#e2e8f0",
      textStyle: { color: props.isDark ? "#e2e8f0" : "#1e293b", fontSize: 11 },
      formatter: (params: unknown[]) => {
        const items = params as { seriesName: string; value: number; color: string }[];
        let html = `<div style="font-size:10px;margin-bottom:4px;color:${textColor}">${items[0] ? labels[0] : ""}</div>`;
        items.forEach((item) => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${item.color};display:inline-block"></span>
            <span>${item.seriesName}: <b style="font-family:monospace">${formatUSD(item.value, true)}</b>
            </span></div>`;
        });
        return html;
      },
    },
    legend: { show: false },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { color: textColor, fontSize: 9, interval: "auto" },
      axisLine: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: textColor,
        fontSize: 10,
        formatter: (val: number) => formatUSD(val, true),
      },
      splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
    },
    series: [
      {
        name: "Long",
        type: "line",
        data: longData,
        smooth: 0.4,
        symbol: "none",
        lineStyle: { color: "#22c55e", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(34,197,94,0.35)" },
              { offset: 1, color: "rgba(34,197,94,0.03)" },
            ],
          },
        },
        emphasis: { focus: "series" },
      },
      {
        name: "Short",
        type: "line",
        data: shortData,
        smooth: 0.4,
        symbol: "none",
        lineStyle: { color: "#ef4444", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(239,68,68,0.35)" },
              { offset: 1, color: "rgba(239,68,68,0.03)" },
            ],
          },
        },
        emphasis: { focus: "series" },
      },
    ],
  };
});
</script>
