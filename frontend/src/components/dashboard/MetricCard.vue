<template>
  <div
    class="rounded-xl p-4 border transition-all duration-300"
    :class="
      isDark
        ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
    "
  >
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <p
          class="text-xs font-medium uppercase tracking-wider truncate"
          :class="isDark ? 'text-slate-500' : 'text-slate-500'"
        >
          {{ label }}
        </p>
        <div
          class="mt-1.5 font-mono text-xl font-bold tracking-tight truncate transition-all duration-300"
          :class="valueClass"
        >
          {{ formattedValue }}
        </div>
        <p
          v-if="subtitle"
          class="mt-1 text-xs truncate"
          :class="isDark ? 'text-slate-500' : 'text-slate-400'"
        >
          {{ subtitle }}
        </p>
      </div>
      <div
        class="text-2xl shrink-0 w-9 h-9 flex items-center justify-center rounded-lg"
        :class="iconBgClass"
      >
        {{ icon }}
      </div>
    </div>

    <!-- Progress bar (optional) -->
    <div v-if="progress !== undefined" class="mt-3">
      <div class="flex justify-between text-xs mb-1" :class="isDark ? 'text-slate-500' : 'text-slate-400'">
        <span>{{ progressLeftLabel }}</span>
        <span>{{ progressRightLabel }}</span>
      </div>
      <div class="h-1.5 rounded-full overflow-hidden" :class="isDark ? 'bg-slate-800' : 'bg-slate-200'">
        <div
          class="h-full rounded-full transition-all duration-700 ease-out"
          :class="progressBarClass"
          :style="{ width: `${Math.max(2, Math.min(98, progress))}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  valueClass?: string;
  iconBgClass?: string;
  progress?: number;
  progressLeftLabel?: string;
  progressRightLabel?: string;
  progressBarClass?: string;
  isDark?: boolean;
}>();

const formattedValue = computed(() =>
  typeof props.value === "number" ? props.value.toLocaleString() : props.value
);
</script>
