# Repository instructions

After each coherent change passes verification, create a Git commit for it.

- Run the checks appropriate to the change before committing.
- Review the diff and stage only the files relevant to the change. Leave unrelated edits alone.
- Use a concise commit message that describes the outcome.

## Playable build

Every commit that changes the game must be a meaningful improvement in a working state that I can start and test. There is no build step: the build is `index.html` and its files.

- Before committing, open the game in a browser, run a bout to the end, and check the console for errors.
- Don't commit half-finished or broken work.
- After committing, give me the commit hash, the command that starts the game (`open index.html` from the project folder), and what to try.
- If you couldn't run the game, say so and don't call the commit tested.

## Subagents

- Work in the primary agent by default.
- Use one read-only subagent only when I ask, or to review a risky change to combat logic (timing, hit detection, resources). Give it the diff and a specific question.
- Don't run parallel agents that edit code.
