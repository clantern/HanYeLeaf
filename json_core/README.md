# JSON Core

This folder contains the canonical, portable, JSON-serializable representation of the HanYe Leaf algorithm.

It is intentionally runtime-agnostic and should not depend on Python-specific classes or app logic. The core stores state as plain dictionaries, lists, numbers, and strings, and accepts injected clock and RNG functions in host runtimes.

The Python simulation and analysis code should consume this core or mirror its semantics, while the client/CLI/site layers may implement their own I/O and presentation concerns.
