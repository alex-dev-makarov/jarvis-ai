# Performance Patterns Reference

Source of truth for `jarvis-perf`'s `patternMatch` field. If a finding
doesn't match anything documented here, the correct answer is exactly
`"no comparable pattern on file"` — this file is not meant to be
exhaustive of every performance pattern that exists, only the ones we've
deliberately catalogued. Do not extend `patternMatch` reasoning beyond
what's written here; add a new case to this file first if a new pattern
proves recurring, rather than letting `jarvis-perf` improvise a comparison.

Sources: eBay and Treebo cases are from Addy Osmani's published case
studies (web.dev / Chrome Dev Channel). Netflix case is Addy Osmani's
Dev Channel write-up on Netflix's logged-out homepage. Cases 5 and 6 are
observed patterns from real audits, generalized — no company attribution.

---

## Case 1 — eBay: payload trim, critical path, image discipline

Source: "Optimizing speed on eBay.com" (Addy Osmani, web.dev / Medium, 2023).

**Headline metric:** for every 100ms improvement in search page load time,
eBay measured a 0.5% increase in "Add to Cart" count — a concrete
load-time-to-conversion link worth citing when justifying a `lazy`/`remove`
fix that's small in isolation but compounds across traffic volume.

**Payload trim across ALL text resources.** Not just JS — eBay trimmed
unused/unnecessary bytes across JavaScript, CSS, HTML, *and* JSON API
responses. The trap they named explicitly: every new feature added to the
payload without anyone removing what became unused afterward — the bloat
was incremental and unintentional, accumulating because cleanup kept
getting deprioritized.

**Match this pattern when:** a finding shows payload growth from
accretion — nobody added one big unused blob on purpose, it built up
feature-by-feature over time with no corresponding cleanup pass.

**Critical path optimization for above-the-fold content.** Their backend
service layer explicitly prioritized fetching and flushing above-the-fold
data first (in parallel, from upstream services), with below-the-fold data
sent in a later chunk or lazy-loaded. This is a backend/API-shaping
pattern, not just a frontend lazy-load — the "cut" is in how the service
layer sequences what it fetches and returns, not only in what the client
chooses to render first.

**Image discipline: format + enforcement, not per-developer judgment.**
Two separate points: (1) standardized on WebP for search-result images
across platforms; (2) crucially, moved the optimization rule INTO the
upload tooling itself for hand-curated images (e.g. homepage hero
modules), rather than leaving correct sizing/format up to whoever uploaded
the image. The "cut" is closing the gap between rigorously-optimized
listing images and loosely-optimized curated/marketing images — the fix
was tooling-level enforcement, not a one-time manual cleanup.

**Match this pattern when:** a finding shows inconsistent image
optimization between two classes of images in the same app (e.g. one
image pipeline is disciplined, another — often marketing/CMS-driven — is
not) — the durable fix is enforcing the rule in the tool that produces the
asset, not a one-off manual pass.

**Predictive prefetch during idle time.** Using `requestIdleCallback()`
(or an equivalent idle-time hook), eBay prefetches static assets (CSS/JS)
for the NEXT likely page in a known user flow (home → search → item),
based on the actual navigation flow, not guesswork. Explicit caveat: this
only helps FIRST-time navigations in a session — on repeat navigations
the assets are already cached, so there's no compounding benefit from
prefetching the same transition twice.

**Prefetching top search results — measured impact.** Analytics showed
users were highly likely to click into the top 5 items in search results.
eBay prefetches those top 5 during idle time — the measured impact was a
**759ms** faster median above-the-fold time (their above-the-fold custom
metric, similar in spirit to First Meaningful Paint) — NOT a generic TTI
number, be precise about which metric moved. This has both a server-side
half (item service pre-caches top-10 items server-side, globally rolled
out) and a client/browser-cache half (rolled out in a subset of markets)
— the two halves shipped independently and don't need to land together.

**Match this pattern when:** a finding shows a page/flow with a
well-established "most likely next click" (search results → item,
category → product, etc.) where the next-likely target isn't being
prefetched at all during idle time.

**Edge-cached autosuggest, 24h TTL — the personalization caveat.**
Autosuggest results cached at the CDN edge for up to 24 hours (results for
a given letter-combination don't change faster than that). **The explicit
catch:** eBay's autosuggest had personalization elements that could NOT be
cached efficiently — this was fine for native apps (where the
personalization UI could be separated from the raw suggestion data) but
for the web, in international markets, eBay judged that latency mattered
more than the small personalization benefit and served the CDN-cached
(non-personalized) version globally for non-US web traffic. **When
matching a finding against this pattern, check whether the caching
candidate has any per-user variance before treating "add an edge cache"
as the fix** — if there is variance, the fix is either excluding that
variance from the cache key, or (as eBay did for one platform) making an
explicit latency-vs-personalization tradeoff call, not silently caching
personalized output.

**Edge-cached HTML for unrecognized/first-time homepage visitors.**
Separate from autosuggest: eBay also cached full homepage HTML at the edge
specifically for visitors with no personalization context yet (first
visit, or a fresh session) — content for unrecognized users in a given
region is identical, so it's cacheable even though the homepage
"creatives" change frequently. This is narrower than "cache the whole
homepage" — it's specifically the unrecognized-user slice of homepage
traffic.

---

## Case 2 — Treebo: the full staged optimization journey (React → Preact PWA)

Source: "A React And Preact Progressive Web App Performance Case Study:
Treebo" (Addy Osmani & Lakshya Ranganath, Dev Channel / Medium, 2017).
React/Preact PWA for a hotel booking site — closest reference case to a
typical Jarvis project (React-based, route-heavy, booking/e-commerce-
shaped flows). Lean on this one first when pattern-matching.

**Why the staged numbers matter:** this case study is valuable specifically
because each optimization's impact — INCLUDING REGRESSIONS — was measured
in isolation, in sequence. Match a finding against the SPECIFIC stage
below, not just "Treebo" generally, and note that some legitimate
optimizations regress TTI even while improving perceived/paint metrics —
that tradeoff is the point, not a contradiction to explain away.

**Stage-by-stage (their actual measured numbers, old mobile site as baseline):**
- Old server-rendered (Django) mobile site: first paint 1.5s, first
  meaningful paint 5.9s, first interactive 6.5s
- Basic client-side-only React SPA: first paint regressed to 4.8s (nothing
  renders until JS runs), first interactive ~5.6s
- Added Server-Side Rendering (`renderToString()`): first paint improved
  to 1.1s, first meaningful paint to 2.4s — but first interactive
  REGRESSED to 6.6s. **This is the key caveat for this pattern:** SSR is
  not free — the browser now fetches a larger HTML payload AND still has
  to fetch/parse/execute the JS on top of it; the main thread gets pegged
  executing JS while the page already visually looks ready, which is
  arguably a worse experience (looks interactive, isn't). Match this when
  a finding proposes "just add SSR" without accounting for TTI impact on
  lower-end devices.
- Added route-based code-splitting (vendor/runtime/routes as separate
  chunks): first interactive improved to 4.8s. Downside noted: the
  current route's JS didn't start downloading until the initial bundles
  finished executing — sequential, not parallel.
- Added PRPL pattern (`<link rel="preload">` for the current route's
  chunk specifically, layered on top of code-splitting): first interactive
  to 4.6s — this fixed the above downside by getting the current route's
  chunk into cache before webpack asked for it.
- Added HTML streaming (early `<head>` chunk with preload tags streamed
  first, late chunk with SSR'd HTML + state streamed after): first paint
  to 0.9s, first interactive to 4.4s — their best first-interactive number
  in the whole sequence. Downside: keeps the client-server connection open
  longer, which matters more on high-latency connections.
- Added inlined critical-path CSS + async-loaded the rest via `loadCSS` on
  `DOMContentLoaded`: first paint improved further to 0.4s, but first
  interactive REGRESSED slightly to 4.6s — larger inline payload took
  longer to parse before JS could run. Same "paint vs interactive tradeoff"
  shape as the SSR stage above — inlining critical CSS is a genuine
  above-the-fold win, but don't assume it's free on TTI.
- Added Service Worker precaching of static assets (`sw-precache-webpack-
  plugin`): no first-load number changed, but repeat visits load
  near-instantly from disk cache instead of network, plus offline support.
  Also opts JS into V8's code cache on repeat visits (faster startup, not
  just faster download).
- Switched React → Preact in production: vendor bundle **140KB → 100KB**
  (gzipped), first interactive **4.6s → 3.9s** on their target mobile
  hardware. Required `preact-compat` aliasing and — explicitly — some
  compatibility workarounds for React-ecosystem packages that assume
  React's exact API surface. Framed as a last-resort, app-wide-blast-radius
  lever, not a file-level fix.

**Match "switch React→Preact" specifically when:** the finding is about
overall framework footprint, not a single component/route — and always
surface it as a suggestion (per jarvis-perf.md's verdict vocabulary,
Preact is never a `remove`/`lazy` verdict on a specific file), since it's
a build-wide decision with ecosystem compatibility risk attached.

**Skeleton screens via "preview mode" components.** Rather than a generic
skeleton component wrapping everything, Treebo built preview-awareness
INTO their atomic components themselves (their `<Text>`/`<Image>` etc.
components accept `preview`/`previewStyle` props and render a greyed
placeholder sized appropriately when the real data isn't loaded yet). The
benefit named explicitly: the preview-mode logic is independent of WHERE
the data comes from, so it's reusable across any loading scenario, not
wired to one specific fetch. Lowers the UX cost of any `lazy` verdict
elsewhere — a `lazy`-loaded component is a much easier call to make when
its loading state is a shaped placeholder instead of a blank flash.

---

## Case 3 — Treebo: bundle-analyzer-driven dependency fixes

Same source as Case 2. Split out separately because these are
DEPENDENCY-level findings (via `webpack-bundle-analyzer`), distinct from
the staged rendering-architecture journey above.

**Heavy dependency with a dead part — moment.js locale bloat.** Importing
`moment.js` normally bundles ALL locale data by default — Treebo's
moment.js footprint was **~61.95KB gzipped** before any fix. Using
webpack's `IgnorePlugin` (`new webpack.IgnorePlugin(/^\.\/locale$/,
/moment$/)`) to strip locale files they didn't need dropped moment.js
itself to **~16.48KB gzipped**, and dropped their TOTAL vendor bundle from
**~179KB → ~119KB** — a 60KB cut from the bundle served on every first
load. This is the canonical "heavy-dependency-with-dead-part" pattern.

**Match this pattern when:** a finding shows a large library where only a
fraction of its surface is actually reachable from the app's code paths —
not just "this library is big" in the abstract. moment.js locale data is
the textbook example (the app uses 1-2 locales, ships all of them by
default); look for the same shape in other libraries (icon sets, UI kits,
polyfill bundles) that ship far more than any single app path touches.

**Duplicate-by-function — qs vs query-string.** Treebo was explicitly
using the `qs` module for query-string parsing. Bundle analysis showed
`react-router` already transitively pulled in `history`, which itself
pulled in `query-string` — a second library doing the exact same job,
already present in the dependency tree. Switching their own code to use
the already-present `query-string` (installing it explicitly, removing
`qs`) saved **2.72KB gzipped** — modest in isolation, but the pattern
matters more than the number: neither library was "unused," they were
DUPLICATED.

**Match this pattern when:** a finding shows two libraries in the
dependency tree solving the same problem (two date libraries, two HTTP
clients, two query-string parsers, two UUID generators, etc.) — the fix is
consolidating onto whichever one is ALREADY pulled in transitively by
something else you depend on (check bundle analyzer output for this
before assuming you need to add or remove anything), not just flagging one
as "the unused one" (it usually isn't unused, it's redundant).

---

## Case 4 — Netflix: shipping less JavaScript beats optimizing more JavaScript

Source: "A Netflix Web Performance Case Study" (Addy Osmani, Dev Channel
/ Medium, 2018). Scope: Netflix's LOGGED-OUT homepage (sign-up/sign-in
entry point) specifically — not the logged-in member experience, which
has very different requirements (heavy interactivity, personalization).

**Headline result:** Time-to-Interactive dropped by **over 50%** — not by
optimizing their existing React code, but by asking whether React was
needed on that page AT ALL, and removing it (React stayed server-side
only; ALL client-side JS for this page — React, Lodash, and app code
built on them — was removed). Total JS payload dropped by **over 200KB**.
React's own client-side footprint was "only" 45KB gzipped — the bulk of
the 200KB+ savings came from the utility libraries and app code BUILT
around having React client-side available, not from React itself. This is
the key nuance: the cost of a framework isn't just its own bundle size,
it's everything that gets pulled in because the framework is assumed to
be there.

**The diagnostic method that led here — deliberately crude and effective:**
Netflix's team turned OFF JavaScript entirely in the browser and observed
which page elements still worked. Since most of the logged-out homepage's
content and layout was plain HTML, this cleanly separated "needs JS" from
"doesn't." What genuinely needed JS turned out to be small, well-scoped
interactions:
- Basic tab-switching interactions (halfway down the page)
- A language switcher (rewritten in under 300 lines of vanilla JS)
- A cookie consent banner (non-US visitors)
- Client-side analytics logging
- Performance measurement/logging
- An ad-attribution pixel bootstrap (sandboxed in an iframe)

None of these needed a component framework — each was ported to plain
JavaScript individually.

**Match this pattern when:** a finding shows a page that is MOSTLY static
content/layout (a landing page, a marketing page, a simple form-entry
page) but loads a full component framework + state management + utility
libraries to run a handful of genuinely small interactive widgets. The
"toggle JS off and see what breaks" method is the reproducible howFound
technique for this pattern specifically — cite it if you use it.

**Prefetching for the NEXT step, even after removing the framework for
THIS step.** Netflix didn't abandon React for the rest of the sign-up
flow (a real single-page app after the landing page) — they kept it,
and used idle time on the landing page to prefetch React + the next
step's JS/CSS bundle via BOTH `<link rel="prefetch">` (browser-native,
best-effort, not universally supported) AND a manual XHR-based prefetch
(`new XMLHttpRequest(); xhrRequest.open('GET', '../bundle.js', true);
xhrRequest.send();` — used specifically because it had a measured ~95%
cache-priming success rate for them, vs. `<link rel=prefetch>`'s
best-effort nature). This combination cut Time-to-Interactive by **30%**
for the follow-up navigation into the actual sign-up flow. Explicit note:
XHR prefetching cannot prefetch HTML documents (only JS/CSS/other
sub-resources) — for HTML, they relied on `<link rel=prefetch>`.

**Match this pattern when:** a finding shows a multi-step flow where step
1 is lightweight/static but step 2 requires a much heavier bundle (a
framework, a large form library, etc.) that isn't being prefetched during
the idle time users spend on step 1.

**The tradeoff, stated explicitly (don't oversimplify this case to "just
remove React"):** Netflix's own framing is that this is a tradeoff, not a
universal rule — server-render the landing page WITHOUT a client framework
for fast first load, but prefetch the framework for the rest of the flow
that genuinely needs it as an SPA. The lesson is "don't ship a framework
for a page that doesn't need one," not "frameworks are bad" — Netflix kept
React for the parts of the flow with real interactivity requirements.

---

## Case 5 — Unconditional third-party script in a shared layout

Observed pattern, not from the sourced case studies above — generalized
from real audit findings.

A third-party script (analytics tag manager, chat widget, ad pixel — any
`afterInteractive`-or-similar third-party bootstrap) rendered
unconditionally in a root/shared layout that every route passes through,
with no idle-time deferral and no consent/interaction gate. Even when
already using the framework's "load after interactive" mechanism (e.g.
Next.js `next/script strategy="afterInteractive"`), that only delays
*when in the page lifecycle* it loads — it does not delay *whether* it
competes for main-thread time immediately after hydration, on every single
route, regardless of whether the user ever interacts with whatever the
script enables (chat widget never opened, consent never given, etc).

**Match this pattern when:** a finding shows a third-party script mounted
at the layout/app-shell level (not scoped to the page(s) that actually
need it) with no gate — no `requestIdleCallback`, no consent-based mount,
no interaction-triggered load.

**Verdict:** `defer-third-party` — these scripts' bytes don't tree-shake
away, so `remove` is wrong; the fix is gating WHEN it loads (idle
callback, consent gate, or scoping the mount to only the routes/
interactions that actually need it), not removing it.

**Divergence note:** tends to matter more on mobile (slow-4G, weaker CPU
competing with hydration) than desktop, but check both — a
main-thread-heavy third-party script can be noticeable even on desktop
right after hydration if it's large enough.

---

## Case 6 — Rarely-used modal/widget statically imported into a shared layout

Observed pattern, not from the sourced case studies above — generalized
from real audit findings.

A modal, dialog, or secondary feature (verification flow, settings panel,
onboarding widget — anything most visits to a route never actually
trigger) is statically imported and unconditionally rendered in a SHARED
layout that many pages pass through, rather than being scoped to only the
one page/route that opens it or lazy-loaded on demand. If that component
itself pulls in a heavy dependency (a carousel library, a QR/barcode
renderer, a rich editor) plus its own CSS, that weight ships on every page
under the shared layout — including the vast majority of visits where the
modal is never opened.

**Match this pattern when:** a finding shows a statically-imported
component in a layout file (not a leaf page) whose actual trigger
condition (a button click, a specific state) is rare relative to how many
routes render the layout it lives in.

**Verdict:** `lazy` — load the component (and its dependencies) only when
the trigger condition is met, e.g. `next/dynamic` / `React.lazy` behind
the button or state check that would open it, not at the layout's
top-level import.

**Divergence note:** low impact on desktop/broadband if the shipped weight
is modest; can be meaningful on slow-4G if the component pulls in a heavy
dependency (carousel, chart, editor, etc.) — check what the modal actually
imports before judging severity, a plain form modal is a much smaller
finding than one bundling a full carousel library.

---

## How to extend this file

If `jarvis-perf` repeatedly encounters a pattern not covered here across
multiple audits, that's a signal to add a new case — write it in the same
shape as the cases above: what the pattern looks like, what the fix was
(with real measured numbers where available), any caveat that changes
whether the pattern actually applies, and which verdict term it maps to.
Keep it to documented, verified precedents — this file is deliberately not
a general performance-tips list. When citing a sourced case study, name
the source; when generalizing from an internal audit, say so explicitly
(as Cases 5-6 do) rather than implying it came from a published source.