# HanYe Leaf Algorithm *《汉叶算法》*

A spaced-repetition scheduler for character-based languages. It notices which *part* of a word you keep forgetting, and brings up other words that contain that part. It could also work for cases where your flashcard terms have some concepts in common, and identify if there is a core concept that needs focus and help with that.
This project serves as a platform for multiple speculative flashcard improvements to the Leitner system.

## The idea

Flashcard schedulers typically treat every card as independent. But in Chinese and Japanese, words are built from characters that recur across the vocabulary. If you keep forgetting 解决, the trouble may really be 解 or 决, and you will meet those characters again in 了解, 理解, 决定 and many other words.

Instead of drilling 解决 alone, HanYe brings back those related words. The weak character is reinforced through the different words it naturally appears in, which is how many learners already study by hand.

It's called HanYe Leaf (汉叶) because if the subject is the tree and the concepts are the branches, we are further dividing into "leaves" in the parts or characters. Also, the project is optimized for Chinese because that's what I'm using it for.

## How it works

The algorithm has two layers. The full rules are in [ALGORITHM.md](ALGORITHM.md).

1. **Leitner boxes.** Every item sits in a box. A correct answer moves it up, a wrong answer moves it down, and higher boxes are reviewed less often. This is a common flashcard system.
2. **Leaf system.** Every part has a *weakness* score. When you fail an item, the weakness of each of its parts goes up. When you succeed, it decays. If a part's weakness passes a threshold, the part is *weak*. It is highlighted on cards, and another item containing it is queued a few cards later.

For example, if you fail 解决 several times in a row, 解 and 决 become weak. A few cards later you might see 理解, a word you already know that contains 解. Getting it right lowers 解's weakness, and the extra attention fades on its own.

## Hypothesis

Reviewing items that share a weak part, spaced a few cards apart, improves later retention of that part compared with scheduling every item independently.

## Status

| Piece | State |
|-------|-------|
| Algorithm spec | Draft, see [ALGORITHM.md](ALGORITHM.md) for the rules and open questions |
| Python terminal prototype | Working |
| Vocabulary | Not started |
| Real word-list pipeline | Not started |
| Review log and experiments | Not started |
| Web app | Not started |



## Roadmap

- [ ] Append-only review log (timestamp, item, result, latency, why the card was picked)
- [ ] Simulator that sweeps `weakness_threshold`, `weakness_decay` and `leaf_delay`
- [ ] Per-part holdout: disable Leaf boosting for a fixed random half of parts, to measure whether it helps
- [ ] Hysteresis or a continuous variant of the weak-part rule
- [ ] "Which part did you miss?" prompt after a failure
- [ ] Real word-list build script
- [ ] Static web app, with progress stored in the browser and JSON export/import

## Design goals

- **Generic:** items made of parts, not Chinese-specific. The same algorithm should fit Japanese kanji or other compound-heavy material.
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
