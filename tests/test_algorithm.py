from core.algorithm import HanziLeafSystem


def test_review_progresses_and_updates_part_weakness():
    system = HanziLeafSystem()
    item = system.add_item(
        item_id="item-1",
        question="汉字",
        answer="Chinese character",
        parts=["汉", "字"],
    )

    item = system.review_item("item-1", success=True, now=100)

    assert item.box == 1
    assert item.last_reviewed == 100
    assert system.part_weakness("汉") == 0.6
    assert system.part_weakness("字") == 0.6


def test_pick_sibling_prefers_highest_box_oldest_last_shown():
    system = HanziLeafSystem()
    system.add_item("item-1", "汉字", "answer-1", ["汉", "字"])
    system.add_item("item-2", "汉人", "answer-2", ["汉", "人"])
    system.add_item("item-3", "汉族", "answer-3", ["汉", "族"])

    system.items["item-1"].box = 1
    system.items["item-2"].box = 1
    system.items["item-3"].box = 2
    system.items["item-1"].last_shown = 10
    system.items["item-2"].last_shown = 30
    system.items["item-3"].last_shown = 20

    sibling = system.pick_sibling("汉", exclude_id="item-1")

    assert sibling == "item-3"
