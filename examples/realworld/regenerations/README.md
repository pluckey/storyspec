# Regenerations

Experiments testing the thesis behind this example: a product's stories and outside-in acceptance tests are the durable
asset, and an agent can regenerate the code from them.

## 2026-10-09: TypeScript, from the stories, the acceptance tests and the Hurl suite

**Setup:** a fresh agent, with no access to `app/` or to this conversation, was given only the stories, the acceptance tests (pytest over HTTP), and `hurl/`. It built the API in TypeScript (Hono, `pg`) against a Postgres running in America/Chicago time.

**Result**

| Measure | Value |
|---|---|
| Acceptance tests | 49/49 |
| Official RealWorld suite | 13/13 files |
| storyspec | all stories `done` |
| Effort | about 7.7 minutes and 142K tokens; 923 lines; no test ever failed |
| Silent choices | about 27 (`2026-10-09-typescript/GAPS.md`) |

At least five of the silent choices differed from this implementation, while every test passed:

| Choice | Python | TypeScript |
|---|---|---|
| Token lifetime | 7 days | 30 days |
| Slug clashes | `-2`, `-3` | a random hex suffix |
| Out-of-range paging | clamped | 422 |
| Trimming | stored as entered | trimmed |
| Tag order | alphabetical | most-used first |

**What it showed**
- **The executable tests carried the specification; the prose oriented.** Exact codes, messages, the error envelope, and which fields lists leave out were all settled by assertions.
- **Bugs written down as scenarios survived the rewrite.** UTC times survived because S-006.5 existed; the regeneration didn't need to rediscover them.
- **Judgment calls didn't survive.** That led to `### Decisions` in each spec: every judgment call is pinned by a scenario or marked free.
  - Six new scenarios pin the choices every implementation must keep (S-003.8, S-006.6, S-008.5, S-010.4, S-013.6, S-014.2).
  - Against the TypeScript regeneration, the pins on slug clashes, paging and tag order fail, as they should.
  - The tag-order pin first passed against it by coincidence, because every tag was used once, and was strengthened.
- **The result is probably inflated.** RealWorld is famous, so the model likely knows it. A fair test needs a product the model hasn't seen.
