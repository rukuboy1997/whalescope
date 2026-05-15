<template>
  <div
    class="rounded-xl border p-3 flex flex-wrap items-center gap-3"
    :class="
      isDark
        ? 'bg-slate-900/70 border-slate-800'
        : 'bg-white border-slate-200 shadow-sm'
    "
  >
    <!-- Time Range -->
    <div class="flex items-center gap-1.5">
      <span class="text-xs font-medium mr-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
        Range:
      </span>
      <button
        v-for="range in timeRanges"
        :key="range.value"
        @click="store.setTimeRange(range.value)"
        class="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 active:scale-95 border"
        :class="
          store.timeRange === range.value
            ? isDark
              ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/40'
              : 'bg-cyan-50 text-cyan-700 border-cyan-300'
            : isDark
            ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300 hover:bg-slate-700'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
        "
      >
        {{ range.label }}
      </button>
    </div>

    <div class="w-px h-5" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />

    <!-- Side Filter -->
    <div class="flex items-center gap-1.5">
      <span class="text-xs font-medium mr-1" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
        Side:
      </span>
      <button
        v-for="side in sideFilters"
        :key="side.value"
        @click="store.setSideFilter(side.value)"
        class="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 active:scale-95 border"
        :class="
          store.sideFilter === side.value
            ? side.activeClass
            : isDark
            ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300 hover:bg-slate-700'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
        "
      >
        {{ side.label }}
      </button>
    </div>

    <div class="w-px h-5" :class="isDark ? 'bg-slate-700' : 'bg-slate-200'" />

    <!-- Min Value Filter -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium" :class="isDark ? 'text-slate-400' : 'text-slate-500'">
        Min $:
      </span>
      <select
        :value="store.minValueFilter"
        @change="store.setMinValueFilter(Number(($event.target as HTMLSelectElement).value))"
        class="px-2 py-1 rounded-md text-xs font-medium border transition-colors outline-none"
        :class="
          isDark
            ? 'bg-slate-800 text-slate-300 border-slate-700 focus:border-cyan-500'
            : 'bg-white text-slate-700 border-slate-200 focus:border-cyan-400'
        "
      >
        <option value="0">Any</option>
        <option value="10000">$10K</option>
        <option value="50000">$50K</option>
        <option value="100000">$100K</option>
        <option value="500000">$500K</option>
        <option value="1000000">$1M+</option>
      </select>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Stream status badge -->
    <div
      class="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
      :class="
        store.isPaused
          ? isDark
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-amber-50 border-amber-200 text-amber-700'
          : store.connectionStatus === 'connected'
          ? isDark
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : isDark
          ? 'bg-slate-700 border-slate-600 text-slate-400'
          : 'bg-slate-100 border-slate-200 text-slate-500'
      "
    >
      <span
        class="w-1.5 h-1.5 rounded-full"
        :class="
          store.isPaused
            ? 'bg-amber-400'
            : store.connectionStatus === 'connected'
            ? 'bg-emerald-400 animate-pulse'
            : 'bg-slate-400'
        "
      />
      <span>{{ store.isPaused ? "Paused" : store.connectionStatus === 'connected' ? "Streaming" : "Offline" }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWhaleStore } from "@/stores/whaleStore";
import type { TimeRange } from "@/types";

defineProps<{ isDark?: boolean }>();

const store = useWhaleStore();

const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "1m", value: 1 },
  { label: "5m", value: 5 },
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
];

const sideFilters: {
  label: string;
  value: "ALL" | "LONG" | "SHORT";
  activeClass: string;
}[] = [
  {
    label: "All",
    value: "ALL",
    activeClass: "bg-cyan-600/20 text-cyan-400 border-cyan-500/40",
  },
  {
    label: "🟢 Long",
    value: "LONG",
    activeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  },
  {
    label: "🔴 Short",
    value: "SHORT",
    activeClass: "bg-red-500/20 text-red-400 border-red-500/40",
  },
];
</script>
