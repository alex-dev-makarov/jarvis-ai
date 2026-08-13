# Data Structure Selection Guide

Consulted by `jarvis-planner` during Step 1 investigation (see
jarvis-planner.md) to decide WHICH data structure a task needs, and by
`jarvis-reviewer` when checking for the "wrong structure for the job"
pattern in a diff. `jarvis-executor` does NOT consult this guide directly
— it implements whatever structure PLANNER already decided on; the choice
itself is not EXECUTOR's call (see jarvis-executor.md's Does NOT). Purpose
of the guide: stop the default reflex of reaching for `Array`/`Object` for
everything, and pick a structure whose shape matches the actual access
pattern.

## Why this matters for cost, not just correctness

The wrong structure often means O(n) where O(1) or O(log n) was available
— `array.find()` in a hot path instead of a `Map` lookup, `array.shift()`
in a queue instead of an actual queue structure. This is invisible in a
code review that only reads the diff for correctness, but it's exactly the
kind of thing that turns into a "why is this slow" investigation later —
cheaper to get right the first time than to diagnose after the fact.

## Decision guide — match the access pattern, not the data "shape"

| If you need... | Reach for | NOT |
|---|---|---|
| Lookup by key, frequent inserts/deletes | `Map` | `Object` (no iteration order guarantee pre-ES2015 semantics, worse for non-string keys, no `.size`) |
| Uniqueness check, membership test | `Set` | `Array` + `.includes()` (O(n) per check vs O(1)) |
| FIFO processing (first in, first out) | An actual queue (ring buffer / linked list based) | `Array.shift()` (O(n) — shifts every remaining element) |
| LIFO (last in, first out) | `Array.push`/`.pop()` is actually fine here | Don't overthink it — push/pop on the END of an array is O(1) |
| Cache with eviction | LRU (Map + doubly-linked list, or a maintained library) | A plain object you manually prune — reinvents LRU badly |
| Weak references (avoid memory leaks in caches keyed by objects) | `WeakMap`/`WeakSet` | `Map`/`Set` when the key is a DOM node or object that should be GC-able |
| Prefix search / autocomplete | Trie | Array of strings + `.filter(s => s.startsWith(...))` for anything beyond a handful of items |
| Fixed-size rolling window (last N events) | Circular buffer | `Array.push()` + `.shift()` to cap length — same O(n) shift problem |
| Priority-based processing | Heap (binary heap / priority queue) | Sorting an array on every insert |
| Graph traversal / relationship data | Actual graph structure (adjacency list/map) | Nested objects trying to represent edges — gets unmanageable past trivial cases |
| Typed numeric data at scale (buffers, binary protocols, large numeric arrays) | `TypedArray` (`Uint8Array`, `Float64Array`, etc.) | Plain `Array` of numbers — TypedArray is more memory-efficient and faster for numeric-only data |
| Object pooling (avoid GC churn from frequent allocation) | Pool pattern | Allocating a new object every time in a hot loop |

## Validation-at-construction over post-hoc checks

See jarvis-reviewer.md's Correctness check #6 for the specific failure
mode: `Object.freeze()` and plain object literals do not validate field
names. A typo on a frozen record silently creates a phantom field instead
of failing loudly. When a data structure holds money, IDs, or anything
where a silent typo would corrupt state — prefer a construct that
validates field names AT CONSTRUCTION (a class with a constructor that
checks keys, a schema-validated factory, or a library structure built for
this) over a plain frozen object.

## When NOT to reach for a fancier structure

Don't over-engineer — per jarvis-executor.md's "rule of three" principle,
a plain array is correct and clearer for small, one-off collections where
performance is irrelevant (a handful of config options, a short list
rendered once). This guide is for access patterns that are genuinely
hot-path, frequent, or scale-sensitive — not a mandate to reach for a Trie
because it exists.

## Project-specific structure libraries

If `jarvis.context.md` names a preferred structures library for this
project (e.g. `metautil`'s `Struct`, `ConsList`, `Pool`, `Semaphore`), that
takes precedence over hand-rolling an equivalent — check
`jarvis.context.md`'s `## Executor Rules` before implementing a custom
version of something the project already has a library for.
