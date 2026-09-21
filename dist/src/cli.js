"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hanYeLeafCore_1 = require("./hanYeLeafCore");
const core = (0, hanYeLeafCore_1.createSystem)({ weakness_threshold: 1, leaf_delay: 0 });
const trace = (0, hanYeLeafCore_1.traceEventSequence)(core, hanYeLeafCore_1.demoEvents);
console.log(JSON.stringify({ events: trace }, null, 2));
