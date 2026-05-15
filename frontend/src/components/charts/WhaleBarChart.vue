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
        Whale Activity
      </span>
      <span class="text-xs" :class="isDark ? 'text-slate-600' : 'text-slate-400'">
        Count per bucket
      </span>
    </div>
    <div class="flex-1 min-h-0 p-2">
      <v-chart
        :option="chartOption"
        autoresize
        class="w-full h-full"
        style="min-height: 180px"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWhaleStore } from "@/stores/whaleStore";

const props = defineProps<{ isDark?: boolean }>();
const store = useWhaleStore();

const chartOption = computed(() => {
  const buckets = store.timeBuckets;
  const labels = buckets.map((b) => b.label);
  const longCounts = buckets.map((b) => store.filteredWhales.filter(
    (w) => w.time >= b.time - 30000 && w.time < b.time + 30000 && w.side === "LONG"
  ).length);
  const shortCounts = buckets.map((b) => store.filteredWhales.filter(
    (w) => w.time >= b.time - 30000 && w.time < b.time + 30000 && w.side === "SHORT"
  ).length);

  const textColor = props.isDark ? "#64748b" : "#94a3b8";
  const splitLineColor = props.isDark ? "#1e293b" : "#f1f5f9";

  return {
    backgroundColor: "transparent",
    animation: true,
    animationDuration: 400,
    grid: { left: 10, right: 12, top: 8, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: props.isDark ? "#1e293b" : "#ffffff",
      borderColor: props.isDark ? "#334155" : "#e2e8f0",
      textStyle: { color: props.isDark ? "#e2e8f0" : "#1e293b", fontSize: 11 },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: textColor, fontSize: 9, interval: "auto" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: splitLineColor, type: "dashed" } },
    },
    series: [
      {
        name: "Long",
        type: "bar",
        stack: "total",
        data: longCounts,
        itemStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "#22c55e" },
              { offset: 1, color: "#16a34a" },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: { itemStyle: { color: "#4ade80" } },
      },
      {
        name: "Short",
        type: "bar",
        stack: "total",
        data: shortCounts,
        itemStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "#ef4444" },
              { offset: 1, color: "#dc2626" },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: { itemStyle: { color: "#f87171" } },
      },
    ],
  };
});
</script>
