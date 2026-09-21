# HanYe Leaf Algorithm

A spaced-repetition scheduler for item collections with recurring parts. It notices which *part* of an item you keep forgetting, and brings up other items that contain that part. It can also work for flashcard terms with shared concepts.
This project serves as a platform for multiple speculative flashcard improvements to the Leitner system.

## The idea

Flashcard schedulers typically treat every card as independent. HanYe Leaf also tracks reusable parts across items, so a weak part can bring related items back into the review queue.

Instead of drilling one item alone, HanYe brings back related items. The weak part is reinforced through the different items in which it appears.

The name reflects the idea that a larger concept can have smaller, reusable leaves: the recurring parts shared by related items.

## How it works

The algorithm has two layers. The full rules are in [ALGORITHM.md](ALGORITHM.md).

1. **Leitner boxes.** Every item sits in a box. A correct answer moves it up, a wrong answer moves it down, and higher boxes are reviewed less often. This is a common flashcard system.
2. **Leaf system.** Every part has a *weakness* score. When you fail an item, the weakness of each of its parts goes up. When you succeed, it decays. If a part's weakness passes a threshold, the part is *weak*. It is highlighted on cards, and another item containing it is queued a few cards later.

For example, if several items containing the same part are repeatedly missed, that part becomes weak. A few cards later, another introduced item containing it can be queued for reinforcement.

## Hypothesis

Reviewing items that share a weak part, spaced a few cards apart, improves later retention of that part compared with scheduling every item independently.

## Status

| Piece | State |
|-------|-------|
| Algorithm spec | Draft, see [ALGORITHM.md](ALGORITHM.md) for the rules and open questions |
| Python terminal prototype | Working |
| Item-list pipeline | Working for configurable CSV input |
| Review log and experiments | Not started |
| Web app | Not started |



## Roadmap

- [ ] Append-only review log (timestamp, item, result, latency, why the card was picked)
- [ ] Simulator that sweeps `weakness_threshold`, `weakness_decay` and `leaf_delay`
- [ ] Per-part holdout: disable Leaf boosting for a fixed random half of parts, to measure whether it helps
- [ ] Hysteresis or a continuous variant of the weak-part rule
- [ ] "Which part did you miss?" prompt after a failure
- [ ] Broader item-list import formats
- [ ] Static web app, with progress stored in the browser and JSON export/import

## Design goals

- **Generic:** items made of parts. The same algorithm should fit any collection with recurring components.
- **Pure core:** the scheduling logic does no I/O and takes the clock and random source as inputs, so it can be simulated and tested.
- **Falsifiable:** log everything needed to compare the algorithm against a plain Leitner baseline.

## Data and licensing

No third-party dictionary or word-list data is bundled. The intended sources for definitions and frequency lists have their own licenses, some with attribution or share-alike requirements, so check each one before redistributing anything.

<!-- TODO: list chosen data sources and their licenses -->

## Contributing

Issues and critique are welcome, especially:
- flaws in the algorithm's reasoning
- real-world results, including negative ones
- ideas for testing the hypothesis with real learners
