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
