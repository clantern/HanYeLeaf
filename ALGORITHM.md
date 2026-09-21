# HanYe Leaf Algorithm *《汉叶算法》*

---

This algorithm follows the tenets of the Leitner Box system, with additional features for material whose items are built from smaller parts that recur across many items. It may also be used where items share concepts, such as flashcards about diseases and affected systems.

## Data

Learning material is stored as **items** made of **parts**. Items are ordered into a progression for the user, such as by difficulty or importance. Each item has a unique question and answer. Unique parts are stored in a separate list.

An item is **introduced** the first time it is presented to the user.

The algorithm keeps this state:

| Scope | Field | Meaning |
|-------|-------|---------|
| Item | `box` | Current box, a non-negative integer |
| Item | `last_reviewed` | Time of the last Leitner review. Used for staleness |
| Item | `last_shown` | Time of the last presentation of any kind, including Leaf presentations. Used to choose siblings |
| Part | `weakness` | A non-negative number, see [Leaf System](#leaf-system) |

## Leitner Box System

1. Each assigned a "box value", a non-negative integer. For many learning objectives, all items will start in Box 0.
2. Once a day, a set of items is added to a queue. First, a number of unseen items `new_limit` *(10)*, then up to a limit of previously seen items `review_limit` (30). As many seen items as possible are added to the queue second, sorted by time since turning stale (see [Parameters](#parameters)), 
*For now, no ordering is imposed on unseen items, but a difficulty ordering may be implemented later*
3. The next item in the queue is presented to the user as a flashcard. The item and its associated question are displayed, and the user reveals the answer.
4. The user gives a subjective evaluation of their success or failure.
5. If the user reports success, the item moves to the next higher box, unless it is already in the highest box. Otherwise, the item moves down `box_drop` boxes, but not below Box 0. Either way, the item's `last_reviewed` is set to the current time.
6. All introduced items are evaluated for "staleness". An item is stale if the time since its `last_reviewed` exceeds the stale time for its box (see [Parameters](#parameters)).
7. Stale items are added to the queue, unless they are already in it.

## Leaf System

The Leaf part of the algorithm recognizes when recall is inhibited by a lack of knowledge of a specific part of an item. When several related items are missed, their shared parts are targeted for association building.

1. When an item is introduced, each of its parts that is not yet in the part list is added with a `weakness` of 1.
2. Whenever the user evaluates an item (whether it was presented as a Leitner review or as a Leaf presentation, see step 3), every part of that item is updated:
    - On success: $\text{weakness} := \text{weakness} \times 0.9$
    - On failure: $\text{weakness} := \text{weakness} + 1$

   *There is some ambiguity in which part actually caused failure, if at all. For now, this will be left as is, with possible diagnostic features to be added later.*
3. A part is **weak** while its weakness is above `weakness_threshold` (4). After each evaluation, for every weak part of the evaluated item, a **sibling** item is chosen:
    1. Consider all introduced items that contain the part, except the item that was just evaluated. If there are none, stop.
    2. Find the highest box that contains one of these items.
    3. From that box, select the item with the oldest `last_shown`.
    4. If no such item can be found, skip this step

   The sibling is added to the queue so that `leaf_delay` (3) other cards are presented before it. If the sibling is already in the queue, it is moved to that position instead and is presented as whatever it was queued as.

   A sibling presented this way is a **Leaf presentation**. It does not count as a flashcard presentation for the purposes of the Leitner Box system: its box and `last_reviewed` are unchanged. It does update `last_shown`, and its evaluation still updates part weakness (step 2).

   *For now there is no limit on the number of Leaf cards presented, but this may have to change if the weakness criterion is triggered too often and the Leaf cards have limited effectiveness.*
4. Weak parts are highlighted on every card that contains them, until the part is no longer weak.

## Parameters

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `box_stale_times` | see below | Time before an item in each box becomes stale |
| `box_drop` | 1 | Boxes an item falls on failure |
| `weakness_initial` | 1 | Weakness of a newly added part |
| `weakness_decay` | 0.6 | Multiplier applied to a part's weakness on success |
| `weakness_increment` | 1 | Amount added to a part's weakness on failure |
| `weakness_threshold` | 10 | A part is weak while its weakness is above this |
| `leaf_delay` | 3 | Number of cards presented before a queued sibling |

Default stale times (Boxes 3 and 4 are placeholders):

| Box | Time before stale |
|-----|-------------------|
| 0 | Immediate (0 seconds) |
| 1 | 1 minute |
| 2 | 5 minutes |
| 3 | 1 day |
| 4 | 1 week |
| 5 | 1 month |

## Pseudocode

```
present(entry, now):                       # entry = (item, kind), kind is LEITNER or LEAF
    item = entry.item
    show item and question; user reveals answer
    success = user_evaluation()

    if not item.introduced:
        item.introduced = true
        for part in item.parts:
            if part not in part_list: part_list[part].weakness = weakness_initial

    if entry.kind == LEITNER:
        if success: item.box = min(item.box + 1, highest_box)
        else:       item.box = max(item.box - box_drop, 0)
        item.last_reviewed = now
    item.last_shown = now

    for part in item.parts:
        if success: part.weakness *= weakness_decay
        else:       part.weakness += weakness_increment

    for part in item.parts:
        if part.weakness > weakness_threshold:
            sibling = pick_sibling(part, exclude=item)
            if sibling: queue.move_or_insert(sibling, kind=LEAF, delay=leaf_delay)

pick_sibling(part, exclude):
    pool = [i for i in introduced_items if part in i.parts and i != exclude]
    if pool is empty: return none
    top = max(i.box for i in pool)
    return the item in pool with i.box == top and the oldest last_shown
```

## Open Questions

- **New items.** Some limit on how many recently failed items (Boxes 0 and 1) can be open at once would keep new material from piling up.
- **Blame.** The weakness of every part of a failed item goes up together. A "which part did you miss?" prompt could assign it precisely.
- **Unintroduced siblings.** Only introduced items are eligible siblings. Allowing unseen items would introduce new material through association, and could also help with sparse vocabularies.