from __future__ import annotations

import json
from pathlib import Path
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class Item:
    id: int
    question: str
    answer: str
    parts: List[str]
    introduced: bool = False
    box: int = 0
    last_reviewed: Optional[float] = None
    last_shown: Optional[float] = None


@dataclass
class QueueEntry:
    item_id: int
    kind: str = "LEITNER"


def _serialize_item(item: Item) -> Dict[str, Any]:
    return {
        "id": item.id,
        "question": item.question,
        "answer": item.answer,
        "parts": list(item.parts),
        "introduced": item.introduced,
        "box": item.box,
        "last_reviewed": item.last_reviewed,
        "last_shown": item.last_shown,
    }


class HanYeLeafSystem:
    def __init__(
        self,
        *,
        box_drop: int = 1,
        weakness_initial: float = 1.0,
        weakness_decay: float = 0.9,
        weakness_increment: float = 1.0,
        weakness_threshold: float = 10.0,
        leaf_delay: int = 3,
        highest_box: int = 5,
        new_limit: int = 10,
        review_limit: int = 30,
        box_stale_times: Optional[Dict[int, float]] = None,
    ) -> None:
        self.box_drop = box_drop
        self.weakness_initial = weakness_initial
        self.weakness_decay = weakness_decay
        self.weakness_increment = weakness_increment
        self.weakness_threshold = weakness_threshold
        self.leaf_delay = leaf_delay
        self.highest_box = highest_box
        self.new_limit = new_limit
        self.review_limit = review_limit
        self.box_stale_times: Dict[int, float] = {
            0: 0.0,
            1: 60.0,
            2: 300.0,
            3: 86400.0,
            4: 604800.0,
            5: 2592000.0,
        }
        if box_stale_times is not None:
            self.box_stale_times.update(box_stale_times)

        self.items: Dict[int, Item] = {}
        self.part_weakness: Dict[str, float] = {}
        self.queue: List[QueueEntry] = []
        self._next_id = 1

    def add_item(self, question: str, parts: List[str], answer: str = "") -> Item:
        unique_parts = list(dict.fromkeys(parts))
        item = Item(
            id=self._next_id,
            question=question,
            answer=answer,
            parts=unique_parts,
        )
        self._next_id += 1
        self.items[item.id] = item

        for part in item.parts:
            self.part_weakness.setdefault(part, float(self.weakness_initial))

        return item

    def is_stale(self, item: Item, *, now: float) -> bool:
        if item.last_reviewed is None:
            return False
        stale_after = self.box_stale_times.get(item.box, float("inf"))
        return (now - item.last_reviewed) > stale_after

    def queue_snapshot(self) -> List[Dict[str, Any]]:
        return [{"item_id": entry.item_id, "kind": entry.kind} for entry in self.queue]

    def state_snapshot(self) -> Dict[str, Any]:
        return {
            "items": [_serialize_item(item) for item in sorted(self.items.values(), key=lambda x: x.id)],
            "part_weakness": dict(sorted(self.part_weakness.items())),
            "queue": self.queue_snapshot(),
        }

    def review(self, item_id: int, success: bool, *, now: float, kind: str = "LEITNER") -> Item:
        item = self.items[item_id]

        if not item.introduced:
            item.introduced = True
            for part in item.parts:
                self.part_weakness.setdefault(part, float(self.weakness_initial))

        if kind == "LEITNER":
            if success:
                item.box = min(item.box + 1, self.highest_box)
            else:
                item.box = max(item.box - self.box_drop, 0)
            item.last_reviewed = now
        elif kind == "LEAF":
            pass
        else:
            raise ValueError(f"Unknown review kind: {kind}")

        item.last_shown = now

        for part in item.parts:
            if success:
                self.part_weakness[part] *= self.weakness_decay
            else:
                self.part_weakness[part] += self.weakness_increment

        for part in item.parts:
            if self.part_weakness.get(part, 0.0) > self.weakness_threshold:
                sibling = self.pick_sibling(part, exclude=item_id)
                if sibling is not None:
                    self._enqueue_sibling(sibling.id, kind="LEAF", delay=self.leaf_delay)

        return item

    def pick_sibling(self, part: str, *, exclude: int) -> Optional[Item]:
        candidates = [
            item
            for item in self.items.values()
            if item.introduced and item.id != exclude and part in item.parts
        ]
        if not candidates:
            return None

        highest_box = max(item.box for item in candidates)
        box_candidates = [item for item in candidates if item.box == highest_box]
        return min(
            box_candidates,
            key=lambda item: item.last_shown if item.last_shown is not None else float("inf"),
        )

    def _enqueue_sibling(self, item_id: int, *, kind: str, delay: int) -> None:
        existing = [entry for entry in self.queue if entry.item_id == item_id]
        existing_kind = existing[0].kind if existing else kind
        for entry in existing:
            self.queue.remove(entry)

        position = min(len(self.queue), max(0, delay))
        self.queue.insert(position, QueueEntry(item_id=item_id, kind=existing_kind))

    def trace_event_sequence(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        trace: List[Dict[str, Any]] = []
        for step_index, event in enumerate(events, start=1):
            action = str(event.get("action", "review"))
            step: Dict[str, Any] = {"step": step_index, "action": action}

            if action == "add_item":
                item = self.add_item(
                    question=str(event["question"]),
                    parts=list(event.get("parts", [])),
                    answer=str(event.get("answer", "")),
                )
                step["item_id"] = item.id
            elif action == "review":
                item_id = int(event["item_id"])
                success = bool(event["success"])
                now = float(event["now"])
                kind = str(event.get("kind", "LEITNER"))
                item = self.review(item_id, success, now=now, kind=kind)
                step["item_id"] = item.id
                step["success"] = success
                step["kind"] = kind
                step["now"] = now
            else:
                raise ValueError(f"Unsupported trace action: {action}")

            state = self.state_snapshot()
            step["items"] = state["items"]
            step["part_weakness"] = state["part_weakness"]
            step["queue"] = state["queue"]
            trace.append(step)

        return trace

    def write_trace_json(self, events: List[Dict[str, Any]], path: str | Path) -> Dict[str, Any]:
        payload = {"events": self.trace_event_sequence(events)}
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        return payload


HanziLeafSystem = HanYeLeafSystem


def build_demo_events() -> List[Dict[str, Any]]:
    return [
        {"action": "add_item", "question": "汉字", "parts": ["汉", "字"], "answer": ""},
        {"action": "add_item", "question": "汉人", "parts": ["汉", "人"], "answer": ""},
        {"action": "review", "item_id": 2, "success": True, "now": 1, "kind": "LEITNER"},
        {"action": "review", "item_id": 1, "success": False, "now": 2, "kind": "LEITNER"},
        {"action": "review", "item_id": 2, "success": True, "now": 3, "kind": "LEAF"},
    ]


def write_demo_traces(root: str | Path = "data/traces") -> Dict[str, Any]:
    root_path = Path(root)
    system = HanYeLeafSystem(weakness_threshold=1, leaf_delay=0)
    events = build_demo_events()
    event_trace = system.write_trace_json(events, root_path / "golden_event_sequence.json")
    queue_trace = {"steps": [{"step": step["step"], "queue": step["queue"]} for step in event_trace["events"]]}
    queue_path = root_path / "golden_queue_trace.json"
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    with queue_path.open("w", encoding="utf-8") as handle:
        json.dump(queue_trace, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    return {"event_trace": event_trace, "queue_trace": queue_trace}


