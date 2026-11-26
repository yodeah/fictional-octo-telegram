# Repository instructions

After each coherent change passes verification, create a Git commit for it.

- Run the checks appropriate to the change before committing.
- Review the diff and stage only the files relevant to the change. Leave unrelated edits alone.
- Use a concise commit message that describes the outcome.

## Codex delegation

- For substantial tasks with independent work, spawn Codex subagents for clearly scoped subtasks. Good candidates include reviewing combat logic, checking the interface in the browser, or verifying a change independently.
- Give each subagent a specific deliverable. Assign disjoint files to agents that edit code, and use read-only assignments when their work overlaps.
- Keep small or tightly coupled tasks in the primary agent. The primary agent integrates the results, runs the final checks, and creates the commit.
