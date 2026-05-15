<template>
  <div
    class="rounded-xl border flex flex-col overflow-hidden"
    :class="isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'"
  >
    <div
      class="px-4 py-3 border-b shrink-0"
      :class="isDark ? 'border-slate-800' : 'border-slate-100'"
    >
      <span class="text-sm font-semibold" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
        Market Radar
      </span>
    </div>
    <div class="flex-1 min-h-0 p-2">
      <v-chart
        :option="chartOption"
        autoresize
        class="w-full h-full"
        style="min-height: 200px"
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
  const data = store.radarData;
  const textColor = props.isDark ? "#64748b" : "#94a3b8";
  const lineColor = props.isDark ? "#1e293b" : "#e2e8f0";
  const sentiment = store.windowStats.sentiment;
  const radarColor =
    sentiment === "BULLISH" ? "#22c55e" : sentiment === "BEARISH" ? "#ef4444" : "#06b6d4";

  return {
    backgroundColor: "transparent",
    tooltip: {
      backgroundColor: props.isDark ? "#1e293b" : "#ffffff",
      borderColor: props.isDark ? "#334155" : "#e2e8f0",
      textStyle: { color: props.isDark ? "#e2e8f0" : "#1e293b", fontSize: 11 },
    },
    radar: {
      indicator: [
        { name: "Bull 🟢", max: 100 },
        { name: "Bear 🔴", max: 100 },
        { name: "Freq ⚡", max: 100 },
        { name: "Vol 💰", max: 100 },
        { name: "Size 🐋", max: 100 },
      ],
      axisName: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: lineColor } },
      splitArea: {
        areaStyle: {
          color: props.isDark
            ? ["rgba(15,23,42,0)", "rgba(30,41,59,0.3)"]
            : ["rgba(255,255,255,0)", "rgba(241,245,249,0.5)"],
        },
      },
      axisLine: { lineStyle: { color: lineColor } },
      shape: "polygon",
      radius: "70%",
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: data,
            name: "Market",
            symbol: "circle",
            symbolSize: 4,
            lineStyle: { color: radarColor, width: 2 },
            areaStyle: { color: `${radarColor}33` },
            itemStyle: { color: radarColor },
          },
        ],
        animation: true,
        animationDuration: 400,
      },
    ],
  };
});
</script>
