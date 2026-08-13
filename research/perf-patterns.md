# Performance Patterns Reference

Source of truth for `jarvis-perf`'s `patternMatch` field. If a finding
doesn't match anything documented here, the correct answer is exactly
`"no comparable pattern on file"` — this file is not meant to be
exhaustive of every performance pattern that exists, only the ones we've
deliberately catalogued. Do not extend `patternMatch` reasoning beyond
what's written here; add a new case to this file first if a new pattern
proves recurring, rather than letting `jarvis-perf` improvise a comparison.

---

## Case 1 — eBay (Addy Osmani)

**Payload trim + critical path.** Above-the-fold content prioritized on
the critical rendering path; everything below the fold deferred. Images
converted to WebP with rules enforced at the upload/tooling layer, not
left to per-developer discipline.

**Predictive prefetch.** During idle time (`requestIdleCallback` /
router-level idle hooks), the router pre-fetches likely next routes
(`router.prefetch()`) and pre-fires the data layer for the top-N most
likely next views (RTK Query's `.initiate()` dispatched ahead of
navigation, not waiting for the route to actually mount). Prefetching the
top search results measurably cut time-to-interactive on the follow-up
navigation — **−759ms** measured impact.

**Edge-cached autosuggest, 24h TTL.** Autosuggest results cached at the
edge for a full day. Explicit caveat that matters for pattern-matching:
this **breaks if personalization leaks into the cache key** — if the
autosuggest response varies per-user (logged-in state, location,
personalization signals) and that variance isn't excluded from the cache
key, you get either cache poisoning (one user's personalized results
served to another) or an effectively-零-hit-rate cache (every request
gets a unique key). When matching a finding against this pattern, check
whether the caching candidate has any per-user variance before treating
"add an edge cache" as the fix.

---

## Case 2 — Treebo (Addy Osmani & Ranganath) — closest match to our stack

React/Preact PWA for a hotel booking site — this is the **closest
reference case** to a typical Jarvis project (React-based, route-heavy,
booking/e-commerce-shaped flows), so lean on this one first when
pattern-matching.

**Bundle analyzer as the primary diagnostic tool.** Not guesswork — actual
bundle composition analysis drove every subsequent decision below.

**Heavy dependency with a dead part — moment.js.** Full `moment.js`
(including locale data nobody used) bloated the vendor bundle. Trimming to
only the needed locale(s) brought vendor bundle **179KB → 119KB**. This is
the canonical "heavy-dependency-with-dead-part" pattern — match this when
a finding shows a large library where only a fraction of its surface is
actually reachable from the app's code paths, not just "this library is
big."

**Duplicate-by-function — qs vs query-string.** Two different query-string
parsing libraries doing the same job, pulled in transitively by different
dependencies, neither one removable without checking both usage sites
first. Match this pattern when a finding shows two libraries in the
dependency tree solving the same problem — the fix is consolidating to
one, not just flagging the "extra" one as unused (it likely isn't unused,
it's duplicated).

**Route-based code-splitting + PRPL.** Preload the current route's
critical resources, pre-cache the rest, lazy-load everything else
(**P**reload-**R**ender-**P**recache-**L**azy-load). This is the
structural pattern behind most `lazy` verdicts on route-level chunks.

**Inline critical CSS + async the rest, per-route.** Same above-the-fold
logic as eBay's payload trim, applied at the CSS layer specifically, and
scoped per-route rather than globally.

**Service worker precaching static assets.** Serwist for Next.js projects,
workbox-webpack for plain webpack setups — precache static assets via SW
so repeat visits skip the network entirely for unchanged assets.

**Skeleton screens via preview-mode components.** Used specifically to
lower the UX cost of lazy-loading — a `lazy` verdict on a heavy component
is much more acceptable to ship when the loading state isn't a blank flash
but a skeleton that matches the eventual layout.

**React → Preact as a last-resort lever.** **140KB → 100KB** framework
footprint reduction. Explicitly a last-resort — it requires compatibility
workarounds (some React ecosystem packages assume React's exact API
surface). `jarvis-perf` should surface this only as a **suggestion**, never
as a `remove`/`lazy` verdict on its own — this is a framework-level
decision with app-wide blast radius, not a file-level finding.

---

## How to extend this file

If `jarvis-perf` repeatedly encounters a pattern not covered here across
multiple audits, that's a signal to add a new case — write it in the same
shape as the two above: what the pattern looks like, what the fix was, any
caveat that changes whether the pattern actually applies. Keep it to
documented, verified precedents — this file is deliberately not a general
performance-tips list.
