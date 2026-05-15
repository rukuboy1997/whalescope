<template>
  <header
    class="sticky top-0 z-50 border-b transition-colors duration-300"
    :class="
      store.isDarkMode
        ? 'bg-slate-950/90 backdrop-blur-md border-slate-800'
        : 'bg-white/90 backdrop-blur-md border-slate-200'
    "
  >
    <div class="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
      <!-- Brand -->
      <div class="flex items-center gap-2.5 shrink-0">
        <span class="text-2xl">🐋</span>
        <div class="leading-tight">
          <h1 class="text-base font-bold text-cyan-400 leading-none">WhaleScope</h1>
          <p class="text-[10px] font-medium text-slate-500 uppercase tracking-widest leading-none mt-0.5">
            Radar
          </p>
        </div>
      </div>

      <!-- Center: connection + stats pill -->
      <div class="flex items-center gap-3 text-xs">
        <!-- Connection status -->
        <div
          class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium"
          :class="statusStyle.container"
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="[statusStyle.dot, shouldPulse ? 'animate-pulse' : '']"
          />
          <span :class="statusStyle.text">{{ statusLabel }}</span>
        </div>

        <!-- BTC price ticker -->
        <div
          v-if="store.stats.currentPrice > 0"
          class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium"
          :class="store.isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'"
        >
          <span class="text-orange-400 font-bold">₿</span>
          <span>{{ formatUSD(store.stats.currentPrice) }}</span>
        </div>

        <!-- Whale count pill -->
        <div
          class="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
          :class="store.isDarkMode ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border border-cyan-200'"
        >
          🐋 {{ store.stats.whaleCount.toLocaleString() }} whales
        </div>
      </div>

      <!-- Right: controls -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Pause/Resume -->
        <button
          @click="$emit('toggle-pause')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 border"
          :class="
            store.isPaused
              ? store.isDarkMode
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : store.isDarkMode
              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
          "
        >
          <span>{{ store.isPaused ? "▶" : "⏸" }}</span>
          <span class="hidden sm:inline">{{ store.isPaused ? "Resume" : "Pause" }}</span>
        </button>

        <!-- Dark mode toggle -->
        <button
          @click="store.toggleDarkMode()"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all duration-200 active:scale-95 border"
          :class="
            store.isDarkMode
              ? 'bg-slate-800 text-yellow-400 border-slate-700 hover:bg-slate-700'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          "
          :title="store.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          {{ store.isDarkMode ? "☀️" : "🌙" }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWhaleStore } from "@/stores/whaleStore";
import { formatUSD } from "@/utils/formatters";

defineEmits<{ "toggle-pause": [] }>();

const store = useWhaleStore();

const statusLabel = computed(() => {
  if (store.isPaused) return "Paused";

  const map: Record<string, string> = {
    connecting: "Connecting…",
    connected: "Live",
    disconnected: "Reconnecting…",
    error: "Connection Failed",
  };
  return map[store.connectionStatus] ?? store.connectionStatus;
});

const statusStyle = computed(() => {
  const dark = store.isDarkMode;
  if (store.isPaused) {
    return {
      container: dark
        ? "bg-amber-500/10 border-amber-500/30"
        : "bg-amber-50 border-amber-200",
      dot: "bg-amber-400",
      text: dark ? "text-amber-400" : "text-amber-700",
    };
  }

  switch (store.connectionStatus) {
    case "connected":
      return {
        container: dark
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-emerald-50 border-emerald-200",
        dot: "bg-emerald-400",
        text: dark ? "text-emerald-400" : "text-emerald-700",
      };
    case "connecting":
      return {
        container: dark
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-yellow-50 border-yellow-200",
        dot: "bg-yellow-400 animate-pulse",
        text: dark ? "text-yellow-400" : "text-yellow-700",
      };
    case "error":
      return {
        container: dark ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-200",
        dot: "bg-red-400",
        text: dark ? "text-red-400" : "text-red-700",
      };
    default:
      return {
        container: dark
          ? "bg-slate-700/50 border-slate-600"
          : "bg-slate-100 border-slate-200",
        dot: "bg-slate-400",
        text: dark ? "text-slate-400" : "text-slate-600",
      };
  }
});

const shouldPulse = computed(() => !store.isPaused && store.connectionStatus === "connected");
</script>
