"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BOX_STALE_TIMES = void 0;
exports.createSystem = createSystem;
exports.itemList = itemList;
exports.addItem = addItem;
exports.isStale = isStale;
exports.enqueueSibling = enqueueSibling;
exports.pickSibling = pickSibling;
exports.review = review;
exports.scheduleQueue = scheduleQueue;
exports.DEFAULT_BOX_STALE_TIMES = {
    0: 0,
    1: 60,
    2: 300,
    3: 86400,
    4: 604800,
    5: 2592000,
};
function createSystem(overrides = {}, clock = () => 0, rng = Math.random) {
    const state = {
        box_drop: 1,
        weakness_initial: 1,
        weakness_decay: 0.9,
        weakness_increment: 1,
        weakness_threshold: 10,
        leaf_delay: 3,
        highest_box: 5,
        new_limit: 10,
        review_limit: 30,
        box_stale_times: { ...exports.DEFAULT_BOX_STALE_TIMES },
        items: {},
        part_weakness: {},
        queue: [],
        next_id: 1,
        ...overrides,
    };
    return { state, clock, rng };
}
function itemList(state) {
    return Object.values(state.items).sort((a, b) => a.id - b.id);
}
function addItem(core, question, parts, answer = "") {
    const uniqueParts = [...new Set(parts)];
    const item = {
        id: core.state.next_id,
        question,
        answer,
        parts: uniqueParts,
        introduced: false,
        box: 0,
        last_reviewed: null,
        last_shown: null,
    };
    core.state.next_id += 1;
    core.state.items[item.id] = item;
    for (const part of item.parts) {
        if (!(part in core.state.part_weakness)) {
            core.state.part_weakness[part] = core.state.weakness_initial;
        }
    }
    return item;
}
function isStale(state, item, now) {
    if (item.last_reviewed === null) {
        return false;
    }
    const staleAfter = state.box_stale_times[item.box] ?? Number.POSITIVE_INFINITY;
    return now - item.last_reviewed > staleAfter;
}
function enqueueSibling(state, itemId, kind, delay) {
    const existing = state.queue.filter((entry) => entry.item_id === itemId);
    const existingKind = existing[0]?.kind ?? kind;
    state.queue = state.queue.filter((entry) => entry.item_id !== itemId);
    const position = Math.min(state.queue.length, Math.max(0, delay));
    state.queue.splice(position, 0, { item_id: itemId, kind: existingKind });
}
function pickSibling(state, part, exclude) {
    const candidates = Object.values(state.items).filter((item) => item.introduced && item.id !== exclude && item.parts.includes(part));
    if (candidates.length === 0) {
        return null;
    }
    const highestBox = Math.max(...candidates.map((item) => item.box));
    const boxCandidates = candidates.filter((item) => item.box === highestBox);
    return boxCandidates.reduce((oldest, candidate) => {
        const oldestShown = oldest.last_shown ?? Number.POSITIVE_INFINITY;
        const candidateShown = candidate.last_shown ?? Number.POSITIVE_INFINITY;
        return candidateShown < oldestShown ? candidate : oldest;
    });
}
function review(core, itemId, success, options = {}) {
    const state = core.state;
    const item = state.items[itemId];
    if (!item) {
        throw new Error(`Unknown item id: ${itemId}`);
    }
    const kind = options.kind ?? "LEITNER";
    const now = options.now ?? core.clock();
    if (!item.introduced) {
        item.introduced = true;
    }
    if (kind === "LEITNER") {
        item.box = success
            ? Math.min(item.box + 1, state.highest_box)
            : Math.max(item.box - state.box_drop, 0);
        item.last_reviewed = now;
    }
    else if (kind !== "LEAF") {
        throw new Error(`Unknown review kind: ${kind}`);
    }
    item.last_shown = now;
    for (const part of item.parts) {
        const oldWeakness = state.part_weakness[part] ?? state.weakness_initial;
        state.part_weakness[part] = success
            ? oldWeakness * state.weakness_decay
            : oldWeakness + state.weakness_increment;
    }
    for (const part of item.parts) {
        if ((state.part_weakness[part] ?? 0) > state.weakness_threshold) {
            const sibling = pickSibling(state, part, itemId);
            if (sibling) {
                enqueueSibling(state, sibling.id, "LEAF", state.leaf_delay);
            }
        }
    }
    return item;
}
function scheduleQueue(core, now) {
    const state = core.state;
    const queuedIds = new Set(state.queue.map((entry) => entry.item_id));
    const newItems = itemList(state).filter((item) => !item.introduced && !queuedIds.has(item.id));
    const staleItems = itemList(state)
        .filter((item) => item.introduced && isStale(state, item, now) && !queuedIds.has(item.id))
        .sort((left, right) => {
        const leftAge = now - (left.last_reviewed ?? now);
        const rightAge = now - (right.last_reviewed ?? now);
        return rightAge - leftAge;
    });
    for (const item of newItems.slice(0, state.new_limit)) {
        state.queue.push({ item_id: item.id, kind: "LEITNER" });
    }
    for (const item of staleItems.slice(0, state.review_limit)) {
        state.queue.push({ item_id: item.id, kind: "LEITNER" });
    }
    return state.queue;
}
