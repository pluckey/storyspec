---
"storyspec": patch
"create-storyspec": patch
---

Docs: the pytest `verifies` hook adds the scenario at collection time, so a test that fails in setup is still reported against its scenario ("fails", not "no test").
