# create-storyspec

## 0.2.0

### Minor Changes

- Projects can now take framework updates. The agent guidance (AGENTS.md, the Claude Code `/story` command and hooks) ships in the package, and `storyspec sync` writes it into a project inside version-stamped blocks, leaving the project's own text alone and refusing to overwrite hand edits unless `--force`. Unedited 0.1 projects are migrated whole on their first sync. The trace warns when the guidance is stale (`framework-sync`), and `sync --check` fails in CI.
  
  The trace now reports every failing test (`failing-test`): a failing scenario in a story that isn't done (a draft's only warns), a failing test outside the stories such as a contract suite, and a test file that crashed. Before, these could leave the trace green.
  
  `rules` in `storyspec.config.json` sets a rule's severity for a project (`"error"`, `"warning"` or `"off"`).
  
  New guidance in AGENTS.md: compose per entry point, cross-cutting rules, deferring an infeasible scenario, platform facts with evidence, assertions for probabilistic adapters, tests against a deployed system, and how to update.
