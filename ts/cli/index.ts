import { resolve } from "node:path";
import { addItem, createSystem, scheduleQueue } from "../core/hanYeLeafCore";
import { defaultItemListConfig, loadItemListCsv } from "./itemList";

const now = Date.now() / 1000;
const core = createSystem({}, () => now);
const itemListPath = process.argv[2] ?? resolve(process.cwd(), "data", "itemlist.csv");
const itemList = loadItemListCsv(itemListPath, defaultItemListConfig);

for (const item of itemList) {
  addItem(core, item.question, item.parts, item.answer);
}

scheduleQueue(core, now);

console.log(JSON.stringify({ items: Object.values(core.state.items), queue: core.state.queue }, null, 2));