"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWordListCsv = parseWordListCsv;
exports.loadWordListCsv = loadWordListCsv;
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
function parseWordListCsv(csv) {
    return csv
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line, index) => {
        const [question, pinyin, answer, ...extraFields] = parseCsvLine(line, index + 1);
        if (!question || !pinyin || !answer || extraFields.length > 0) {
            throw new Error(`CSV line ${index + 1} must contain exactly: word,pinyin,meaning`);
        }
        return {
            question,
            pinyin,
            answer,
            parts: [...question],
        };
    });
}
function loadWordListCsv(path) {
    return parseWordListCsv((0, node_fs_1.readFileSync)(path, "utf8"));
}
