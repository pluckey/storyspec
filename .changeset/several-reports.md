---
"storyspec": minor
"create-storyspec": minor
---

A tier can read several test reports: `testReport` and a tier's `report` accept a list (for example pytest's JUnit and a conformance suite's), and a listed report the run didn't write is skipped. JUnit test cases with no file or class (Hurl's) are reported by their name instead of "(unknown file)". The config schema now describes `tiers` and `defaultProof`, which editors had flagged as unknown since 0.3.
