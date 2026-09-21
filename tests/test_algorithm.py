import pytest

from core.algorithm import HanYeLeafSystem


def test_new_item_initializes_part_weakness():
    system = HanYeLeafSystem()
    item = system.add_item("汉字", ["汉", "字"])

    system.review(item.id, True, now=1)

    assert item.introduced is True
    assert item.box == 1
    assert system.part_weakness["汉"] == 0.9
    assert system.part_weakness["字"] == 0.9


def test_weak_part_enqueues_sibling_as_leaf():
    system = HanYeLeafSystem(weakness_threshold=1, leaf_delay=0)
    first = system.add_item("汉字", ["汉", "字"])
    second = system.add_item("汉人", ["汉", "人"])

    system.review(second.id, True, now=1)
    system.review(first.id, False, now=2)

    assert system.queue[0].item_id == second.id
    assert system.queue[0].kind == "LEAF"


def test_leaf_review_does_not_change_box_or_last_reviewed():
    system = HanYeLeafSystem()
    item = system.add_item("汉字", ["汉", "字"])

    system.review(item.id, True, now=10, kind="LEAF")

    assert item.box == 0
    assert item.last_reviewed is None
    assert item.last_shown == 10


def test_enqueue_sibling_preserves_existing_kind():
    system = HanYeLeafSystem()
    item = system.add_item("汉字", ["汉", "字"])
    system.queue.append(type("Entry", (), {"item_id": item.id, "kind": "LEITNER"})())

    system._enqueue_sibling(item.id, kind="LEAF", delay=0)

    assert system.queue[0].item_id == item.id
    assert system.queue[0].kind == "LEITNER"


def test_review_requires_now_and_tracks_staleness_defaults():
    system = HanYeLeafSystem()
    item = system.add_item("汉字", ["汉", "字"])

    with pytest.raises(TypeError):
        system.review(item.id, True)

    assert system.box_stale_times[0] == 0
    assert system.box_stale_times[1] == 60
    assert system.new_limit == 10
    assert system.review_limit == 30

    item.box = 2
    item.last_reviewed = 0
    assert system.is_stale(item, now=301)
