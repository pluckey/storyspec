# Adopting story-spec in an existing repo

You don't have to restructure everything at once. Stories can grow beside existing code.

1. `npm i -D story-spec vitest`
2. Add `story-spec.config.json`. Point `storyMayImport`, `layers` and `wiring` at your real folders, or start with `"layers": {}` so only story rules apply.
3. Add scripts: `"gen": "story-spec gen"`, `"story": "story-spec story"`, `"trace": "story-spec trace"`.
4. Write the next feature as a story: `npm run story -- "…"`, scenarios, `npm run gen`, `story(gen, …)` tests, then the use case in the story folder.
5. Wire the use case from wherever your composition happens, and add that file to `wiring`.
6. When an existing feature changes, consider moving its logic into a story as part of the change. Leave the rest alone.
7. Tighten `layers` gradually as code moves behind ports. Run `story-spec trace` in CI from day one so new stories stay clean.

Run `npx story-spec sync` to add the agent guidance: a story-spec block in `AGENTS.md`, and with `--claude` (or once the project has a `CLAUDE.md` or `.claude/`) the `CLAUDE.md` block, the `/story` command and the hooks. If your repo already has an `AGENTS.md`, the block goes under its title and your text stays. Write notes about your folders and conventions outside the block.

## Projects that aren't TypeScript

story-spec runs on Node, but the code it traces can be any language. A Python project:

```
stories/S-001-greet-a-person/
  story.md        front matter adds: implementedBy: app/greet.py
  spec.md         the requirement and its scenarios, as in any project
app/greet.py      # @implements S-001
conftest.py       the verifies marker (below)
tests/test_greet.py
```

```python
@pytest.mark.verifies("S-001.1")
def test_greets_by_name():
    assert greet("Ada") == "Hello, Ada!"

def test_S_001_2_greets_a_stranger():   # or name the scenario in the function name
    assert greet(None) == "Hello, stranger!"
```

The `verifies` marker needs this in `conftest.py`, which writes the scenario into pytest's JUnit report:

```python
import pytest

def pytest_configure(config):
    config.addinivalue_line("markers", "verifies(scenario, tier=None): the story-spec scenario this test proves")

def pytest_collection_modifyitems(items):
    # At collection, so the scenario is in the report even when a test fails in setup.
    for item in items:
        marker = item.get_closest_marker("verifies")
        if marker:
            item.user_properties.append(("scenario", marker.args[0]))
            if marker.kwargs.get("tier"):
                item.user_properties.append(("tier", marker.kwargs["tier"]))
```

```json
{
  "testCommand": "pytest --junitxml=.story-spec/junit.xml",
  "testReport": ".story-spec/junit.xml",
  "layers": { "app/domain": ["app/domain"], "app/adapters": ["app/domain", "app/adapters"] }
}
```

- **`implementedBy:`** lists the files that implement the story, since Python can't import from a folder named `S-001-…`. Any file type works, so it also suits a story implemented by Terraform or a policy file.
- **Tests live wherever pytest finds them.** The trace learns which scenarios they prove from the JUnit report (see [how tests are matched](rules.md#other-test-runners-and-languages)).
- **Layers work in Python too.** story-spec reads their imports with [ast-grep](https://ast-grep.github.io), so `layers` (for example `"app/domain": ["app/domain"]`) is checked as it is for TypeScript. A Python import maps to `a/b.py` or `a/b/__init__.py`. The RealWorld example (`examples/realworld`) enforces its hexagonal layers this way.
- **What stays TypeScript-only:** the typed `story()` helper and `scenarios.gen.ts`.

Install story-spec with `npm i -D story-spec` (a `package.json` beside `pyproject.toml` is enough) and run `npx story-spec check`.

## Updating story-spec

The agent guidance comes from the installed story-spec version, so it updates with the package:

```bash
npm i -D story-spec@latest
npx story-spec sync     # rewrites the story-spec blocks and files from the new version
npx story-spec migrate  # updates the project if the version changed its format (0.9: the rename; 0.3: status: done → in-progress)
npm run check
```

A project made before the package took this name moves with one command; the README's migration note says what it changes.

`sync` changes only what story-spec owns: the marked blocks in `AGENTS.md` and `CLAUDE.md`, the `/story` command, and the hooks whose command runs story-spec. Each block is stamped with the version it came from and a hash of its text, so `sync` knows when it's stale and when someone edited it by hand; it won't overwrite a hand edit unless you pass `--force`. Until you sync, the trace warns (`framework-sync`). In CI, `story-spec sync --check` fails if the guidance is out of date. A project made from the 0.1 template whose files were never edited is migrated whole on its first sync.

New rules arrive as warnings when they could break existing projects. Use `rules` in `story-spec.config.json` to choose a rule's severity for your project.
