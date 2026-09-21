import { createSystem, demoEvents, traceEventSequence } from "../core/hanYeLeafCore";

const core = createSystem({ weakness_threshold: 1, leaf_delay: 0 });
const trace = traceEventSequence(core, demoEvents);

console.log(JSON.stringify({ events: trace }, null, 2));
