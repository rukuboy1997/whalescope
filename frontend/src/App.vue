<template>
  <div
    class="min-h-screen transition-colors duration-300"
    :class="store.isDarkMode ? 'dark bg-slate-950' : 'bg-slate-100'"
  >
    <AppHeader @toggle-pause="stream.togglePause()" />

    <main class="max-w-screen-2xl mx-auto px-3 sm:px-4 pb-8">
      <!-- Dashboard Controls -->
      <div class="mt-4">
        <DashboardControls :is-dark="store.isDarkMode" />
      </div>

      <!-- Metric Cards Row -->
      <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <!-- Total Whales -->
        <MetricCard
          label="Whales Detected"
          :value="store.stats.whaleCount"
          :subtitle="`${store.recentWhaleCount} in last 60s`"
          icon="🐋"
          :is-dark="store.isDarkMode"
          :icon-bg-class="store.isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50'"
          :value-class="store.isDarkMode ? 'text-cyan-400' : 'text-cyan-700'"
        />

        <!-- Biggest Whale -->
        <MetricCard
          label="Biggest Whale"
          :value="store.stats.biggestWhale > 0 ? formatUSD(store.stats.biggestWhale) : '—'"
          subtitle="All time max"
          icon="⚡"
          :is-dark="store.isDarkMode"
          :icon-bg-class="store.isDarkMode ? 'bg-yellow-500/10' : 'bg-yellow-50'"
          :value-class="store.isDarkMode ? 'text-yellow-400' : 'text-yellow-600'"
        />

        <!-- Market Sentiment -->
        <MetricCard
          label="Sentiment"
          :value="`${getSentimentIcon(store.windowStats.sentiment)} ${store.windowStats.sentiment}`"
          :subtitle="`Last ${store.timeRange}m window`"
          icon="📊"
          :is-dark="store.isDarkMode"
          :icon-bg-class="store.isDarkMode ? 'bg-purple-500/10' : 'bg-purple-50'"
          :value-class="getSentimentColor(store.windowStats.sentiment)"
        />

        <!-- Long/Short Ratio -->
        <MetricCard
          label="Long / Short"
          :value="`${store.longShortRatio}% / ${100 - store.longShortRatio}%`"
          :subtitle="`${store.windowStats.count} trades in window`"
          icon="⚖️"
          :is-dark="store.isDarkMode"
          :icon-bg-class="store.isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'"
          :value-class="store.isDarkMode ? 'text-slate-200' : 'text-slate-800'"
          :progress="store.longShortRatio"
          progress-left-label="Long"
          progress-right-label="Short"
          :progress-bar-class="progressBarClass"
        />
      </div>

      <!-- Charts + Feed Grid -->
      <div class="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">

        <!-- Left/Main column (2/3 width) -->
        <div class="xl:col-span-2 flex flex-col gap-4">

          <!-- BTC Price Line Chart -->
          <PriceLineChart :is-dark="store.isDarkMode" style="min-height: 240px" />

          <!-- Volume Area + Whale Bar (side by side) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VolumeAreaChart :is-dark="store.isDarkMode" style="min-height: 220px" />
            <WhaleBarChart :is-dark="store.isDarkMode" style="min-height: 220px" />
          </div>

          <!-- Radar + Window Stats (side by side on larger screens) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SentimentRadarChart :is-dark="store.isDarkMode" style="min-height: 240px" />
            <WindowStatsCard :is-dark="store.isDarkMode" />
          </div>
        </div>

        <!-- Right column: Activity Feed (1/3 width) -->
        <div class="xl:col-span-1">
          <ActivityFeed
            :is-dark="store.isDarkMode"
            height="calc(100% - 0px)"
            class="sticky top-[4.5rem] max-h-[calc(100vh-6rem)]"
          />
        </div>
      </div>

      <!-- Error / Disconnected banner -->
      <Transition name="fade">
        <div
          v-if="store.connectionStatus === 'error'"
          class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl border text-sm font-medium flex items-center gap-3 shadow-2xl"
          :class="
            store.isDarkMode
              ? 'bg-red-950/90 border-red-800 text-red-300 backdrop-blur-md'
              : 'bg-red-50 border-red-200 text-red-700'
          "
        >
          <span>⚠️</span>
          <span>Connection failed. Check that the backend is running.</span>
          <button
            @click="stream.connect()"
            class="ml-2 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            :class="store.isDarkMode ? 'bg-red-700 hover:bg-red-600 text-red-100' : 'bg-red-200 hover:bg-red-300 text-red-800'"
          >
            Retry
          </button>
        </div>
      </Transition>

      <!-- Paused overlay indicator -->
      <Transition name="fade">
        <div
          v-if="store.isPaused"
          class="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-xl border text-sm font-medium flex items-center gap-2 shadow-xl"
          :class="
            store.isDarkMode
              ? 'bg-amber-950/90 border-amber-700 text-amber-300 backdrop-blur-md'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          "
        >
          <span>⏸</span>
          <span>Stream paused</span>
          <button
            @click="stream.resume()"
            class="ml-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all"
            :class="
              store.isDarkMode ? 'bg-amber-700 hover:bg-amber-600 text-amber-100' : 'bg-amber-200 hover:bg-amber-300 text-amber-800'
            "
          >
            Resume
          </button>
        </div>
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useWhaleStore } from "@/stores/whaleStore";
import { useWhaleStream } from "@/composables/useWhaleStream";
import { formatUSD, getSentimentColor, getSentimentIcon } from "@/utils/formatters";

import AppHeader from "@/components/layout/AppHeader.vue";
import MetricCard from "@/components/dashboard/MetricCard.vue";
import DashboardControls from "@/components/dashboard/DashboardControls.vue";
import ActivityFeed from "@/components/dashboard/ActivityFeed.vue";
import PriceLineChart from "@/components/charts/PriceLineChart.vue";
import VolumeAreaChart from "@/components/charts/VolumeAreaChart.vue";
import WhaleBarChart from "@/components/charts/WhaleBarChart.vue";
import SentimentRadarChart from "@/components/charts/SentimentRadarChart.vue";
import WindowStatsCard from "@/components/dashboard/WindowStatsCard.vue";

const store = useWhaleStore();
const stream = useWhaleStream();

const progressBarClass = computed(() => {
  const ratio = store.longShortRatio;
  if (ratio >= 60) return "bg-emerald-500";
  if (ratio <= 40) return "bg-red-500";
  return "bg-cyan-500";
});

onMounted(() => {
  stream.connect();
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px) translateX(-50%);
}
</style>
