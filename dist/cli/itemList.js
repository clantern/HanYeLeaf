"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultItemListConfig = void 0;
exports.parseItemList = parseItemList;
exports.loadItemListCsv = loadItemListCsv;
const node_fs_1 = require("node:fs");
function parseCsvLine(line, lineNumber) {
    const fields = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (quoted && line[index + 1] === '"') {
                field += '"';
                index += 1;
            }
            else {
                quoted = !quoted;
            }
        }
        else if (character === "," && !quoted) {
            fields.push(field.trim());
            field = "";
        }
        else {
            field += character;
        }
    }
    if (quoted) {
        throw new Error(`Unclosed quoted field on CSV line ${lineNumber}`);
    }
    fields.push(field.trim());
    return fields;
}
function splitParts(value, separator) {
    if (separator === "characters" || separator === undefined) {
        return [...value];
    }
    return value.split(separator).map((part) => part.trim()).filter(Boolean);
}
function parseItemList(csv, config) {
    return csv
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line, index) => {
        const fields = parseCsvLine(line, index + 1);
        const question = config.questionColumns.map((column) => fields[column] ?? "").join(" ").trim();
        const answer = fields[config.answerColumn]?.trim() ?? "";
        const partsValue = fields[config.partsColumn]?.trim() ?? "";
        if (!question || !answer || !partsValue) {
            throw new Error(`CSV line ${index + 1} is missing a configured question, answer, or parts value`);
        }
        return {
            question,
            answer,
            parts: splitParts(partsValue, config.partSeparator),
        };
    });
}
function loadItemListCsv(path, config) {
    return parseItemList((0, node_fs_1.readFileSync)(path, "utf8"), config);
}
exports.defaultItemListConfig = {
    questionColumns: [0, 1],
    answerColumn: 2,
    partsColumn: 0,
    partSeparator: "characters",
};
