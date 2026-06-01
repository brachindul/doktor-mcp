---
active: true
iteration: 0
maxIterations: 25
---

Complete Phase 36 (T36.1-T36.7) audit fixes. Critical: T36.1 fix buildReplayFetch to return valid PDF (not text/html) so getDocument accepts it. T36.2 replace guard-based vacuous assertions with hard-fail asserts. T36.3 scan entire test suite for vacuous patterns and fix. T36.4 mutation-sanity: prove tests break when code is broken. T36.5 find real discipline regulation sourceId. T36.6 connect axis coverage to fixture-fed pipeline. T36.7 CHANGELOG + version bump. Rules: build=0, test=green, hard assert must break on failure, vacuous tests forbidden.