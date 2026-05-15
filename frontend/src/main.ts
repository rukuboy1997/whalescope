import { createApp } from "vue";
import { createPinia } from "pinia";
import { use } from "echarts/core";
import { LineChart, BarChart, RadarChart } from "echarts/charts";
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent,
    MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import VChart from "vue-echarts";

import App from "./App.vue";
import "./assets/main.css";

// Register only needed ECharts modules (tree-shaking)
use([
    LineChart,
    BarChart,
    RadarChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    DataZoomComponent,
    MarkLineComponent,
    CanvasRenderer,
]);

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.component("v-chart", VChart);

app.mount("#app");
