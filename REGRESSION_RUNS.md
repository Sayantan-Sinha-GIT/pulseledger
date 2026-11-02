# REGRESSION_RUNS.md — PulseLedger Frozen Regression Suite Runs

| Iteration | Suite | CaseIDs | Method | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | CORE | TC-PUB-01, TC-STA-01, TC-PRB-01, TC-CHK-01, TC-URL-01, TC-CRN-01, TC-AUT-01, TC-INC-01, TC-ACC-01 | Baseline Vitest test suite and Playwright desktop flow | All 9 core journey test cases passed on initial verification | passed | e2e-run-iter1-baseline |
| 2 | CORE | TC-PUB-01, TC-STA-01, TC-PRB-01, TC-CHK-01, TC-URL-01, TC-CRN-01, TC-AUT-01, TC-INC-01, TC-ACC-01 | Adversarial re-execution of frozen core cases after interactive probe addition | All 9 core journey test cases re-executed and passed cleanly | passed | e2e-run-iter2-adversarial |
| 3 | CORE | TC-PUB-01, TC-STA-01, TC-PRB-01, TC-CHK-01, TC-URL-01, TC-CRN-01, TC-AUT-01, TC-INC-01, TC-ACC-01 | Pre-release full regression run on desktop and mobile viewports | All 9 core journey test cases verified with zero regressions | passed | e2e-run-iter3-release |

