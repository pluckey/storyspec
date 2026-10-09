# RealWorld API, built with storyspec

The [RealWorld](https://github.com/gothinkster/realworld) ("Conduit") back end: accounts, profiles, articles, a feed, favorites, comments and tags. It's written in Python (FastAPI and Postgres) and built story by story with [storyspec](../../README.md). It's storyspec's public example. It shows a project that isn't TypeScript, proof tiers, and an external conformance suite as part of proof.

```
stories/S-006-author-publishes-an-article/
  story.md            As a member… (front matter: implementedBy: app/usecases/publish.py)
  spec.md             the requirement and its scenarios {#S-006.1} …
  test_publish.py     one test per scenario: @pytest.mark.verifies("S-006.1")
app/                  domain, ports, use cases, adapters (memory, Postgres), entry (FastAPI)
hurl/                 the official RealWorld API suite, unchanged
```

## Run it

You need Node 22+, Python 3.12+ and, for the deployed tier, Docker and [Hurl](https://hurl.dev).

```bash
pip install -e ".[dev]"
npm install                   # storyspec
npm run check                 # local tier: every scenario against the app in-process
npm run deployed              # deployed tier: docker compose, the official suite and every scenario over HTTP
uvicorn app.entry.http:create_app --factory   # run it (memory storage unless DATABASE_URL is set)
```

## How proof works here

Every scenario needs the `local` and `deployed` tiers (`defaultProof` in `storyspec.config.json`). The same test proves both: the `api` fixture in `conftest.py` is the app in-process on memory adapters, or the running server on Postgres when `storyspec trace --tier deployed` runs `scripts/deployed.sh`. The deployed results are recorded in `stories/PROOF.json`, so `npm run check` shows a story as `done` only when both tiers proved its current text.

The official Hurl suite runs in the deployed tier too. Its tests name no scenario, so they prove nothing on their own, but any failure fails the trace. `FRICTION.md` records where storyspec helped and where it got in the way.

The `.hurl` files are from gothinkster/realworld (MIT License, Copyright (c) 2021 Thinkster); see `hurl/README.md`.
