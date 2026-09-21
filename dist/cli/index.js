"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = require("node:path");
const hanYeLeafCore_1 = require("../core/hanYeLeafCore");
const itemList_1 = require("./itemList");
const now = Date.now() / 1000;
const core = (0, hanYeLeafCore_1.createSystem)({}, () => now);
const itemListPath = process.argv[2] ?? (0, node_path_1.resolve)(process.cwd(), "data", "itemlist.csv");
const itemList = (0, itemList_1.loadItemListCsv)(itemListPath, itemList_1.defaultItemListConfig);
for (const item of itemList) {
    (0, hanYeLeafCore_1.addItem)(core, item.question, item.parts, item.answer);
}
(0, hanYeLeafCore_1.scheduleQueue)(core, now);
console.log(JSON.stringify({ items: Object.values(core.state.items), queue: core.state.queue }, null, 2));
