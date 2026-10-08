# Configuration

`storyspec.config.json` at the repo root is optional; every key has a default. Add `"$schema": "./node_modules/storyspec/schema/storyspec.config.schema.json"` for autocomplete. Unknown keys and wrong types are rejected.

| Key | Default | Meaning |
|---|---|---|
| `idPrefix` | `"S"` | Story IDs look like `S-001`, scenarios like `S-001.1` |
| `storiesDir` | `"stories"` | One sub-folder per story, named `<ID>-<slug>` |
| `storyMayImport` | `["src/domain", "src/ports"]` | Prefixes story code may import besides its own folder |
| `storyTestMayAlsoImport` | `["test"]` | Extra prefixes story tests may import |
| `wiring` | `["src/entry/composition.ts"]` | The only files allowed to import stories |
| `layers` | see below | For each folder, the prefixes its files may import; the longest matching folder applies |
| `portsDir` | `"src/ports"` | Exported interfaces here should each have an adapter |
| `adaptersDir` | `"src/adapters"` | Where adapters live |
| `gapsOnlyWarnFor` | `["draft", "ready"]` | Statuses whose gaps are warnings |
| `mustPassFor` | `["done"]` | Statuses that require every scenario test to pass |
| `exemptStatuses` | `["superseded"]` | Statuses listed in the trace but exempt from every story rule |
| `testCommand` | `"vitest run --passWithNoTests --reporter=json --outputFile=.storyspec/vitest.json"` | Runs the tests and writes a JSON report |
| `testReport` | `".storyspec/vitest.json"` | Where the trace reads results |
| `storyTemplateDir` | `"templates/story"` | Your own `story.md`/`spec.md` templates; built-ins are used if absent |
| `ignore` | `["node_modules", "dist", ".storyspec", ".git"]` | Never scanned |
| `rules` | `{}` | Severity per rule, overriding the default: `{ "slug": "error", "port-adapter": "off" }`. Values are `"error"`, `"warning"` or `"off"` |

Default `layers`:

```json
{
  "src/domain": ["src/domain"],
  "src/ports": ["src/domain", "src/ports"],
  "src/adapters": ["src/domain", "src/ports", "src/adapters"],
  "src/presenters": ["src/domain", "src/presenters"],
  "src/entry": ["src", "stories"],
  "test": ["src/domain", "src/ports", "src/adapters", "test"]
}
```

Paths are matched as prefixes against repo-relative import targets, so `"src/ports"` allows `src/ports/clock` and `src/ports.ts`. Only relative imports are checked; package imports (`vitest`, `zod`) are always allowed.

## Other test runners

The trace reads a Jest/Vitest-style JSON report (`testResults[].assertionResults[].{title,status}`). Jest's `--json --outputFile` produces the same shape, so `"testCommand": "jest --json --outputFile=.storyspec/vitest.json"` works for plain `test('S-001.1 …')` names. The typed `story()` helper is Vitest-only for now.
