---
active: true
iteration: 0
maxIterations: 15
---

Complete Faz 46 (T46.1-T46.6). Core mission: make `node scripts/mutation-check.mjs` return "4/4 invariyant testlerle korunuyor" by writing real protecting tests for each invariant. T46.1: test that cache.set removal breaks tests. T46.2: test that placeholder hint filter removal breaks tests. T46.3: test that malpraktis term removal breaks tests (hint-matching path, not cache-fed). T46.4: add mutation-check to npm scripts + CI. T46.5: update TEST_AUDIT. T46.6: CHANGELOG + bump. Rules: build+test+CI green, no vacuous tests.