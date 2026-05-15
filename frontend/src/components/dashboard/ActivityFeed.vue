<template>
  <div
    class="rounded-xl border flex flex-col overflow-hidden"
    :class="isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-sm'"
    :style="{ height }"
  >
    <!-- Header -->
    <div
      class="px-4 py-3 border-b flex items-center justify-between shrink-0"
      :class="isDark ? 'border-slate-800' : 'border-slate-100'"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold" :class="isDark ? 'text-slate-200' : 'text-slate-800'">
          Activity Feed
        </span>
        <span
          v-if="store.filteredWhales.length > 0"
          class="text-xs px-1.5 py-0.5 rounded-full font-mono"
          :class="isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-700'"
        >
          {{ store.filteredWhales.length }}
        </span>
      </div>
      <!-- Search -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search…"
          class="w-32 px-2.5 py-1 text-xs rounded-lg border outline-none transition-all duration-200 focus:w-40"
          :class="
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-300 placeholder-slate-600 focus:border-cyan-500'
              : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-cyan-400'
          "
        />
      </div>
    </div>

    <!-- Column Headers -->
    <div
      class="px-4 py-1.5 grid text-xs font-medium uppercase tracking-wider border-b shrink-0"
      :class="[
        isDark ? 'text-slate-600 border-slate-800/60' : 'text-slate-400 border-slate-100',
        'grid-cols-[70px_1fr_80px_70px_80px]',
      ]"
    >
      <span>Time</span>
      <span>Value</span>
      <span class="text-center">Side</span>
      <span class="text-right hidden sm:block">Size</span>
      <span class="text-right">Type</span>
    </div>

    <!-- Feed list -->
    <div ref="feedRef" class="flex-1 overflow-y-auto min-h-0">
      <template v-if="displayedWhales.length > 0">
        <TransitionGroup name="whale" tag="div">
          <div
            v-for="whale in displayedWhales"
            :key="`${whale.time}-${whale.value}`"
            class="px-4 py-2 border-b grid items-center text-xs transition-colors duration-150 cursor-pointer"
            :class="[
              'grid-cols-[70px_1fr_80px_70px_80px]',
              isDark
                ? 'border-slate-800/50 hover:bg-slate-800/40'
                : 'border-slate-100 hover:bg-slate-50',
              getSeverityRowClass(getSeverity(whale.value)),
            ]"
            @click="selectedWhale = selectedWhale === whale ? null : whale"
          >
            <!-- Time -->
            <span
              class="font-mono text-[11px]"
              :class="isDark ? 'text-slate-500' : 'text-slate-400'"
            >
              {{ formatTime(whale.time) }}
            </span>

            <!-- Value -->
            <span class="font-mono font-semibold" :class="getValueClass(whale.value)">
              {{ formatUSD(whale.value, whale.value < 100_000) }}
            </span>

            <!-- Side badge -->
            <div class="flex justify-center">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" :class="getSideBadgeClass(whale.side)">
                {{ whale.side }}
              </span>
            </div>

            <!-- Amount -->
            <span
              class="text-right font-mono text-[11px] hidden sm:block"
              :class="isDark ? 'text-slate-500' : 'text-slate-400'"
            >
              {{ whale.amount.toFixed(3) }}
            </span>

            <!-- Severity -->
            <span class="text-right" :title="getSeverityLabel(getSeverity(whale.value))">
              {{ getSeverityEmoji(getSeverity(whale.value)) }}
            </span>
          </div>
        </TransitionGroup>
      </template>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center h-full gap-3 py-12"
        :class="isDark ? 'text-slate-600' : 'text-slate-400'"
      >
        <span class="text-4xl">🔍</span>
        <p class="text-sm font-medium">No whales detected yet</p>
        <p class="text-xs">Waiting for large trades on Pacifica…</p>
      </div>
    </div>

    <!-- Footer count -->
    <div
      v-if="store.filteredWhales.length > maxDisplay"
      class="px-4 py-2 text-xs border-t shrink-0 text-center"
      :class="isDark ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'"
    >
      Showing {{ maxDisplay }} of {{ store.filteredWhales.length }} events
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useWhaleStore } from "@/stores/whaleStore";
import {
  formatTime,
  formatUSD,
  getSeverity,
  getSeverityLabel,
  getSideBadgeClass,
} from "@/utils/formatters";
import type { SeverityLevel, Whale } from "@/types";

defineProps<{ isDark?: boolean; height?: string }>();

const store = useWhaleStore();
const searchQuery = ref("");
const selectedWhale = ref<Whale | null>(null);
const feedRef = ref<HTMLElement | null>(null);
const maxDisplay = 80;

const displayedWhales = computed(() => {
  let list = store.filteredWhales;
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (w) =>
        w.side.toLowerCase().includes(q) ||
        formatUSD(w.value).toLowerCase().includes(q) ||
        (w.direction ?? "").toLowerCase().includes(q)
    );
  }
  return list.slice(0, maxDisplay);
});

function getSeverityEmoji(level: SeverityLevel): string {
  const map: Record<SeverityLevel, string> = {
    small: "🐟",
    whale: "🐋",
    mega: "🦈",
    leviathan: "⚡",
  };
  return map[level];
}

function getSeverityRowClass(level: SeverityLevel): string {
  if (level === "leviathan") return "animate-pulse-slow";
  return "";
}

function getValueClass(value: number): string {
  if (value >= 1_000_000) return "text-yellow-400";
  if (value >= 200_000) return "text-purple-400";
  if (value >= 50_000) return "text-cyan-400";
  return "text-slate-300";
}
</script>
