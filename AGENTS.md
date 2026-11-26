# Repository instructions

After each coherent change passes verification, create a Git commit for it.

- Run the checks appropriate to the change before committing.
- Review the diff and stage only the files relevant to the change. Leave unrelated edits alone.
- Use a concise commit message that describes the outcome.

## Subagents

- Work in the primary agent by default.
- Use one read-only subagent only when I ask, or to review a risky change to combat logic (timing, hit detection, resources). Give it the diff and a specific question.
- Don't run parallel agents that edit code.
