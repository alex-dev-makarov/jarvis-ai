# Jarvis Project Context — jarvis-final
#
# This file is read by the global Jarvis harness at the start of each
# inner-loop session. It provides project-specific rules to global agents
# (jarvis-executor, jarvis-reviewer) without modifying them globally.
#
# Two sections matter:
#   ## Review Rules    → passed to jarvis-reviewer in every I2 brief
#   ## Executor Rules  → passed to jarvis-executor in every I1 brief
#
# TOKEN BUDGET: keep the whole file under ~2,000 tokens (~8,000 characters).
# This loads into every I1/I2 brief — every line here has a real, recurring
# cost. If you reference skill files via @path, their resolved content
# counts toward this budget too.
#
# Delete this comment block once you have filled in your project rules.

## Stack
# Example: Next.js 14 App Router · TypeScript strict · RTK Query · CSS Variables · pnpm
<fill in your stack>

## Review Rules
# Rules the reviewer checks on every PR diff.
# Example entries — replace with your own:
# - RTK Query: providesTags required on every query, invalidatesTags on mutations
# - CSS Variables only — no hardcoded colors (#fff, rgb(), hsl())
# - Server Components by default; use client only when strictly needed
# - Auth tokens: httpOnly cookies only, never localStorage
# - No dangerouslySetInnerHTML without DOMPurify
# - No console.log in production code
<fill in your review rules>

## Executor Rules
# Constraints the executor follows when implementing tasks.
# Example entries — replace with your own:
# - Read max 2 files per step
# - Use grep -n instead of reading whole files
# - Never read: node_modules/, dist/, .next/, pnpm-lock.yaml
# - Co-locate tests: src/components/Foo/__tests__/Foo.test.tsx
<fill in your executor rules>
