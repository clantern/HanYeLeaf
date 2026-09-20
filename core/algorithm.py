from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


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


class HanziLeafSystem:
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
    ) -> None:
        self.box_drop = box_drop
        self.weakness_initial = weakness_initial
        self.weakness_decay = weakness_decay
        self.weakness_increment = weakness_increment
        self.weakness_threshold = weakness_threshold
        self.leaf_delay = leaf_delay
        self.highest_box = highest_box

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

    def review(self, item_id: int, success: bool, *, now: float = 0.0) -> Item:
        item = self.items[item_id]

        if not item.introduced:
            item.introduced = True
            for part in item.parts:
                self.part_weakness.setdefault(part, float(self.weakness_initial))

        if success:
            item.box = min(item.box + 1, self.highest_box)
        else:
            item.box = max(item.box - self.box_drop, 0)

        item.last_reviewed = now
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
        for entry in existing:
            self.queue.remove(entry)

        position = min(len(self.queue), max(0, delay))
        self.queue.insert(position, QueueEntry(item_id=item_id, kind=kind))
