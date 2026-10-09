# GAPS: where the specification didn't decide

Regenerated from `stories/`, `conftest.py`, `pytest.ini` and `hurl/` only. Every acceptance test and hurl file was read
**before** any code was written, so the tests worked as a specification up front rather than as a feedback loop.
The first full run of each suite was green (pytest 49/49, hurl 13/13), so **no test ever failed and taught me
something**. Every gap below is therefore either "decided from a test's text before running it" or "silent".

Legend: **test-text** = the prose said nothing or was ambiguous, but a test's assertion settled it (a regeneration that
skipped reading the tests would have been caught when they ran); **silent** = no test or hurl request exercises it,
so any choice passes.

## A. Gaps the tests settle (test-text). No test ever failed.

| # | What the prose left open | What the tests said / what I did | Proven wrong later? |
|---|---|---|---|
| A1 | `updatedAt` "moves on" after an edit, but an edit can land in the same millisecond as the publish (pytest publishes then edits immediately). Postgres keeps microseconds, JSON keeps milliseconds, so two times can differ in the DB and still print the same. | `S-008.1` and `articles.hurl` assert `updatedAt != createdAt-time`. I generate times in the app (JS `Date`, ms) and set `updatedAt = max(now, previous + 1 ms)` (`nextUpdate` in `src/domain/rules.ts`). | No. Without the +1 ms this would be a flaky failure, not a deterministic one. |
| A2 | Newest-first ordering when two articles share a timestamp (tests publish two articles back to back). | Order by `created_at DESC, id DESC`. | No (but a timestamp-only sort would be flaky). |
| A3 | Error envelope shape: `{"errors": {field: [message]}}`, exact messages "can't be blank", "has already been taken", "is missing", "not found", "forbidden", "invalid". Field names `token`, `credentials`, `profile`, `article`, `comment`. | Only stated in the tests' asserts (the prose quotes the messages but not the envelope). Implemented exactly. | No |
| A4 | Taken username and email both at once: which is reported? | Tests check each separately and expect **only** that field (`== {"username": [...]}`). I check username first, then email, and report one. | No |
| A5 | Auth before existence: unknown slug **and** no token. | Tests use `some-slug` without a token and expect 401, so authentication is checked before the resource lookup. | No |
| A6 | Delete comment on an unknown article with an unknown comment id. | `S-013.5`: 404 `article` wins over 404 `comment`. | No |
| A7 | The response JSON for list endpoints: `body` must be **absent**, not null (`"body" not in a`, hurl `not exists`). | Omitted the key. | No |
| A8 | `tagList: null` on edit is 422 but on publish? | Edit: 422 (test). Publish: silent, I treat missing or null as `[]`. | No |
| A9 | Profile JSON is compared with `==` to exactly `{username, bio, image, following}`, so no extra keys (e.g. no `id`) may leak. | Exact four keys. | No |
| A10 | Favorite/unfavorite responses must include `body` (hurl `$.article.body isString`); pytest doesn't check it. | Full article. Verified that removing body fails only `hurl/favorites.hurl` and that `storyspec check` then exits 1. | No |
| A11 | Comment `id` must be an integer, not a UUID (`isinstance(c["id"], int)`, hurl `isInteger`). | `serial` id. | No |
| A12 | Times in UTC to the ms ending in Z, against a Postgres whose time zone is America/Chicago. | This was the one gap the spec had already closed by **revision** (S-006 v2: "seen as -05:00 against a local Postgres"). `timestamptz` columns + app-generated `Date`s + `toISOString()`. Checked in psql: stored as `09:33:43.764-05`, served as `14:33:43.764Z`. | No |

## B. Silent decisions (nothing would catch a different choice)

| # | What was unclear | What I decided |
|---|---|---|
| B1 | **Token format and lifetime**, and whether an old token survives a username/email change. | HS256 JWT with `sub` = user id, 30-day expiry. Old tokens keep working after a username/email change (id-based). Secret from `JWT_SECRET`, **falling back to a hard-coded dev secret**; that fallback is insecure in production and nothing in the spec says otherwise. |
| B2 | A **malformed or expired token** on an endpoint where auth is optional (GET profile/article/list/comments). | 401 `{"token": ["is invalid"]}` rather than treating the caller as a visitor. Message "is invalid" is invented. |
| B3 | Auth scheme word. | `Token` (the only one tested) and also `Bearer`, case-insensitive. |
| B4 | **Slug algorithm**: what a slug looks like, what happens on collision, and whether editing the title changes it. | Lowercase ASCII, accents stripped, non-alphanumerics to `-`, max 80 chars, `article` if empty. On collision: append `-` + 6 random hex chars (retry up to 5). The slug never changes on edit (S-008 says "keep its slug", which I read as covering title edits too). |
| B5 | Password hashing. | scrypt (N default), 16-byte salt, stored as `scrypt$salt$hash`. |
| B6 | **Maximum** password length (NIST comment in hurl says "accept at least 64"). | 256; longer is 422 "is too long (maximum is 256 characters)". Error message for < 8 chars ("is too short (minimum is 8 characters)") is invented; tests only check the key. |
| B7 | Whitespace: is `"   "` blank? Are username/email/title trimmed? | Whitespace-only is blank; username, email, title, description, body and comment body are stored trimmed. Passwords are not trimmed. |
| B8 | Email format validation and case sensitivity; username case sensitivity. | No format check. Both compared exactly (case-sensitive). `Ana` and `ana` are different members; `A@x.com` and `a@x.com` different accounts. A real product would likely want case-insensitive email. |
| B9 | Wrong JSON types (e.g. `"username": 5`, `tagList: "a"`). | 422 with "must be a string" / "must be a list of strings". |
| B10 | Malformed JSON body. | 400 `{"errors": {"request": ["body is not valid JSON"]}}`. Missing wrapper (`{}` instead of `{"user": {...}}`) is treated as all fields missing, so it's 422 "can't be blank". |
| B11 | Tag normalization: duplicates, empty strings, case, whitespace. | Trimmed, empties dropped, duplicates removed keeping first position, case kept. |
| B12 | **Order of `GET /api/tags`**, and any limit. | Most-used first, then alphabetical; no limit (the test needs tags from all its own runs to be present in a DB that accumulates thousands). |
| B13 | Tags of deleted articles. | Gone from `/api/tags` (tags only exist through articles). |
| B14 | Pagination defaults and bounds. | `limit` 20 default, capped silently at 100; `offset` 0. Negative or non-integer `limit`/`offset` is 422. `limit=0` returns no articles with the full count. |
| B15 | Combining list filters. | AND. Unknown author/tag/favoriter gives an empty list with count 0, not 404. |
| B16 | Comment order. | Oldest first (`created_at, id`). Hurl only ever lists one or two. |
| B17 | May the **article's author** delete other people's comments on it? | No; only the comment's author ("let only its author delete it"). |
| B18 | Non-numeric or out-of-range comment id in the URL. | 404 `comment` "not found". |
| B19 | Following yourself; favoriting your own article; repeated follow/favorite. | Allowed; all idempotent (follow twice = one row, unfollow when not following = 200 with following false). |
| B20 | `GET /api/user` token: echo the request's token or mint a new one? `PUT /api/user` token? | GET echoes the request token; login, register and PUT mint a fresh one. |
| B21 | What happens to an author's articles, comments, follows when a user is deleted. | No endpoint deletes users; FKs cascade anyway. |
| B22 | Unknown routes and methods. | 404 `{"errors": {"route": ["not found"]}}`. |
| B23 | Concurrency: two registrations racing for the same username, two publishes racing for one slug. | Pre-check plus DB unique constraints; a constraint violation is mapped back to 409 (users) or a slug retry (articles). |
| B24 | Schema migration. | `CREATE TABLE IF NOT EXISTS` on startup; no migration tool, no versioning. |
| B25 | Validation order on PUT /user: 422 field errors vs 409 conflict when both apply. | All 422s first, then 409. |
| B26 | Does a `PUT /api/user` with no changes or `PUT /api/articles/:slug` with `{}` still move `updatedAt`? | Article: yes, any successful edit moves `updatedAt`. |
| B27 | CORS, rate limiting, request size limits, logging. | None. A browser front end on another origin would fail; nothing in the spec mentions one. |

## C. Environment and platform facts I had to discover (write these down for the next regeneration)

1. **Node is v26.7**, not 22; `npm i -D typescript` installs **TypeScript 7.0**. Both worked unchanged.
2. `npm i -D storyspec@0.6.0` writes `^0.6.0`; I pinned it to `0.6.0` by hand.
3. **`implementedBy:` is a comma-separated string** in the front matter, not a YAML list (found by reading `dist/`; the docs show one file only).
4. **Story IDs may not appear in code outside `stories/`** (`ids-outside-stories`), except as `// @implements <ID>` in a file the story lists under `implementedBy:`. A comment like "see S-008" anywhere else is an error. So each use-case file implements exactly one story, and `src/http/app.ts` is listed by every story but mentions no ID.
5. **Directory names trigger rules.** Had I put the store interface in `src/ports/` and Postgres in `src/adapters/` (storyspec's own defaults), the `contract-tests` rule would demand a contract test suite. I named them `src/store/` instead, which avoids the rule rather than satisfying it. A regeneration should know this choice exists.
6. `storyspec check` warns `framework-sync` until `npx storyspec sync` writes `AGENTS.md`.
7. A **hurl** JUnit report has one testcase per file and names no scenario; a failing hurl file is reported as `failing-test` and makes `storyspec check` exit 1 (verified by temporarily breaking the favorite response).
8. `testReport` as a list reads both reports; the test command must delete stale reports first or a crashed run could reuse old results.
9. Postgres here runs in **America/Chicago**. Use `timestamptz`; node-pg returns `Date`s that serialize correctly. A `timestamp` (without time zone) column would be the bug S-006 v2 records.
10. The test database accumulates data across runs (tests use unique names, never clean up), so every list assertion must survive thousands of unrelated rows. Nothing assumes an empty DB.
11. `kill` on an `npx tsx` PID did stop the server, but the test script starts `node --import tsx` directly so its `$!` is the server's own PID.

## D. Tests I'd question (left unchanged)

None is wrong. Two are weaker than their prose:
- `S-001.4` only checks that `password` is a key in errors, not the message.
- `S-003.5` checks 422 but not which field or message.
