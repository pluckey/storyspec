---
"storyspec": minor
"create-storyspec": minor
---

`storyspec ui`: a page on localhost for the people who decide what the product does but don't edit files. It answers open decisions, approves draft stories, edits and adds scenarios, and shows each record's lifecycle and the trace's findings. Each change is an edit to a story's files (bumping the version of a story past draft), shown as a diff and refused if the file changed since the page read it. No database: git is the history.
