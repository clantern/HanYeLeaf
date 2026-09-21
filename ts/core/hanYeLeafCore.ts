export type ReviewKind = "LEITNER" | "LEAF";
export type Clock = () => number;
export type RNG = () => number;

export interface Item {
  id: number;
  question: string;
  answer: string;
  parts: string[];
  introduced: boolean;
  box: number;
  last_reviewed: number | null;
  last_shown: number | null;
}

export interface QueueEntry {
  item_id: number;
  kind: ReviewKind;
}

export interface SystemState {
  box_drop: number;
  weakness_initial: number;
  weakness_decay: number;
  weakness_increment: number;
  weakness_threshold: number;
  leaf_delay: number;
  highest_box: number;
  new_limit: number;
  review_limit: number;
  box_stale_times: Record<number, number>;
  items: Record<number, Item>;
  part_weakness: Record<string, number>;
  queue: QueueEntry[];
  next_id: number;
}

export interface SystemCore {
  state: SystemState;
  clock: Clock;
  rng: RNG;
}

export interface TraceEvent {
  action: "add_item" | "review";
  question?: string;
  parts?: string[];
  answer?: string;
  item_id?: number;
  success?: boolean;
  now?: number;
  kind?: ReviewKind;
}

export interface TraceStep {
  step: number;
  action: string;
  item_id?: number;
  success?: boolean;
  kind?: ReviewKind;
  now?: number;
  items: Item[];
  part_weakness: Record<string, number>;
  queue: QueueEntry[];
}

export const DEFAULT_BOX_STALE_TIMES: Record<number, number> = {
  0: 0,
  1: 60,
  2: 300,
  3: 86400,
  4: 604800,
  5: 2592000,
};

const cloneQueue = (queue: QueueEntry[]): QueueEntry[] =>
  queue.map((entry) => ({ item_id: entry.item_id, kind: entry.kind }));

const cloneState = (state: SystemState): SystemState => JSON.parse(JSON.stringify(state)) as SystemState;

export function createSystem(
  overrides: Partial<SystemState> = {},
  clock: Clock = () => 0,
  rng: RNG = Math.random,
): SystemCore {
  const state: SystemState = {
    box_drop: 1,
    weakness_initial: 1,
    weakness_decay: 0.9,
    weakness_increment: 1,
    weakness_threshold: 10,
    leaf_delay: 3,
    highest_box: 5,
    new_limit: 10,
    review_limit: 30,
    box_stale_times: { ...DEFAULT_BOX_STALE_TIMES },
    items: {},
    part_weakness: {},
    queue: [],
    next_id: 1,
    ...overrides,
  };

  return { state, clock, rng };
}

export function itemList(state: SystemState): Item[] {
  return Object.values(state.items).sort((a, b) => a.id - b.id);
}

export function addItem(core: SystemCore, question: string, parts: string[], answer = ""): Item {
  const uniqueParts = [...new Set(parts)];
  const item: Item = {
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

export function isStale(state: SystemState, item: Item, now: number): boolean {
  if (item.last_reviewed === null) {
    return false;
  }
  const staleAfter = state.box_stale_times[item.box] ?? Number.POSITIVE_INFINITY;
  return now - item.last_reviewed > staleAfter;
}

export function enqueueSibling(state: SystemState, itemId: number, kind: ReviewKind, delay: number): void {
  const existing = state.queue.filter((entry) => entry.item_id === itemId);
  const existingKind = existing[0]?.kind ?? kind;

  for (const entry of existing) {
    state.queue = state.queue.filter((candidate) => candidate !== entry);
  }

  const position = Math.min(state.queue.length, Math.max(0, delay));
  state.queue.splice(position, 0, { item_id: itemId, kind: existingKind });
}

export function pickSibling(state: SystemState, part: string, exclude: number): Item | null {
  const candidates = Object.values(state.items).filter(
    (item) => item.introduced && item.id !== exclude && item.parts.includes(part),
  );

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

export function review(
  core: SystemCore,
  itemId: number,
  success: boolean,
  options: { now?: number; kind?: ReviewKind } = {},
): Item {
  const state = core.state;
  const item = state.items[itemId];
  if (!item) {
    throw new Error(`Unknown item id: ${itemId}`);
  }

  const kind = options.kind ?? "LEITNER";
  const now = options.now ?? core.clock();

  if (!item.introduced) {
    item.introduced = true;
    for (const part of item.parts) {
      if (!(part in state.part_weakness)) {
        state.part_weakness[part] = state.weakness_initial;
      }
    }
  }

  if (kind === "LEITNER") {
    if (success) {
      item.box = Math.min(item.box + 1, state.highest_box);
    } else {
      item.box = Math.max(item.box - state.box_drop, 0);
    }
    item.last_reviewed = now;
  } else if (kind !== "LEAF") {
    throw new Error(`Unknown review kind: ${kind}`);
  }

  item.last_shown = now;

  for (const part of item.parts) {
    const oldWeakness = state.part_weakness[part] ?? state.weakness_initial;
    state.part_weakness[part] = success ? oldWeakness * state.weakness_decay : oldWeakness + state.weakness_increment;
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

export function snapshotState(state: SystemState): { items: Item[]; part_weakness: Record<string, number>; queue: QueueEntry[] } {
  return {
    items: itemList(state),
    part_weakness: { ...state.part_weakness },
    queue: cloneQueue(state.queue),
  };
}

export function traceEventSequence(core: SystemCore, events: TraceEvent[]): TraceStep[] {
  const live = { state: cloneState(core.state), clock: core.clock, rng: core.rng };
  const trace: TraceStep[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const stepNumber = index + 1;
    const step: TraceStep = {
      step: stepNumber,
      action: event.action,
      items: [],
      part_weakness: {},
      queue: [],
    };

    if (event.action === "add_item") {
      const item = addItem(live, event.question ?? "", event.parts ?? [], event.answer ?? "");
      step.item_id = item.id;
    } else if (event.action === "review") {
      const item = review(live, event.item_id ?? 0, event.success ?? false, {
        now: event.now,
        kind: event.kind ?? "LEITNER",
      });
      step.item_id = item.id;
      step.success = event.success;
      step.kind = event.kind ?? "LEITNER";
      step.now = event.now;
    }

    const snapshot = snapshotState(live.state);
    step.items = snapshot.items;
    step.part_weakness = snapshot.part_weakness;
    step.queue = snapshot.queue;
    trace.push(step);
  }

  return trace;
}

export const demoEvents: TraceEvent[] = [
  { action: "add_item", question: "汉字", parts: ["汉", "字"], answer: "" },
  { action: "add_item", question: "汉人", parts: ["汉", "人"], answer: "" },
  { action: "review", item_id: 2, success: true, now: 1, kind: "LEITNER" },
  { action: "review", item_id: 1, success: false, now: 2, kind: "LEITNER" },
  { action: "review", item_id: 2, success: true, now: 3, kind: "LEAF" },
];

export function demoTrace(): TraceStep[] {
  return traceEventSequence(createSystem({ weakness_threshold: 1, leaf_delay: 0 }), demoEvents);
}
