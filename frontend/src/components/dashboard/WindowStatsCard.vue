<template>
  <div
    class="rounded-xl border p-4 flex flex-col gap-4"
    :class="isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'"
  >
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
        Window Stats
      </span>
      <span
        class="text-xs font-medium px-2 py-0.5 rounded-full"
        :class="sentimentClass"
      >
        {{ getSentimentIcon(store.windowStats.sentiment) }} {{ store.windowStats.sentiment }}
      </span>
    </div>

    <!-- Long volume -->
    <div>
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          🟢 Long Volume
        </span>
        <span class="text-xs font-mono font-semibold text-emerald-400">
          {{ formatUSD(store.windowStats.longVolume, true) }}
        </span>
      </div>
      <div class="h-1.5 rounded-full overflow-hidden" :class="isDark ? 'bg-slate-800' : 'bg-slate-100'">
        <div
          class="h-full bg-emerald-500 rounded-full transition-all duration-700"
          :style="{ width: `${longPercent}%` }"
        />
      </div>
    </div>

    <!-- Short volume -->
    <div>
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
          🔴 Short Volume
        </span>
        <span class="text-xs font-mono font-semibold text-red-400">
          {{ formatUSD(store.windowStats.shortVolume, true) }}
        </span>
      </div>
      <div class="h-1.5 rounded-full overflow-hidden" :class="isDark ? 'bg-slate-800' : 'bg-slate-100'">
        <div
          class="h-full bg-red-500 rounded-full transition-all duration-700"
          :style="{ width: `${shortPercent}%` }"
        />
      </div>
    </div>

    <!-- Divider -->
    <div class="border-t" :class="isDark ? 'border-slate-800' : 'border-slate-100'" />

    <!-- Stats grid -->
    <div class="grid grid-cols-2 gap-3">
      <div>
        <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">Trades</p>
        <p class="text-lg font-mono font-bold mt-0.5" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
          {{ store.windowStats.count }}
        </p>
      </div>
      <div>
        <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">Total Vol</p>
        <p class="text-lg font-mono font-bold mt-0.5" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
          {{ formatUSD(store.windowStats.longVolume + store.windowStats.shortVolume, true) }}
        </p>
      </div>
      <div>
        <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">Long %</p>
        <p class="text-lg font-mono font-bold mt-0.5 text-emerald-400">{{ longPercent }}%</p>
      </div>
      <div>
        <p class="text-xs" :class="isDark ? 'text-slate-500' : 'text-slate-400'">Short %</p>
        <p class="text-lg font-mono font-bold mt-0.5 text-red-400">{{ shortPercent }}%</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWhaleStore } from "@/stores/whaleStore";
import { formatUSD, getSentimentIcon } from "@/utils/formatters";

defineProps<{ isDark?: boolean }>();
const store = useWhaleStore();

const total = computed(() =>
  store.windowStats.longVolume + store.windowStats.shortVolume || 1
);

const longPercent = computed(() =>
  Math.round((store.windowStats.longVolume / total.value) * 100)
);

const shortPercent = computed(() =>
  Math.round((store.windowStats.shortVolume / total.value) * 100)
);

const sentimentClass = computed(() => {
  const s = store.windowStats.sentiment;
  if (s === "BULLISH") return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
  if (s === "BEARISH") return "bg-red-500/15 text-red-400 border border-red-500/30";
  return "bg-slate-500/15 text-slate-400 border border-slate-500/30";
});
</script>
