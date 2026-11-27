# Repository instructions

After each coherent change passes verification, create a Git commit for it.

- Run the checks appropriate to the change before committing.
- Review the diff and stage only the files relevant to the change. Leave unrelated edits alone.
- Use a concise commit message that describes the outcome.

## Deploy

After each commit, push it with `git push origin HEAD:swords-and-sandals`. That runs `.github/workflows/pages.yml`, which publishes the GitHub Pages site (https://yodeah.github.io/fictional-octo-telegram/). The site also holds the other game under `/arena-2d/`, so keep that file identical on both branches. Check that the **Deploy games to Pages** run for your commit succeeded (`gh run list --branch swords-and-sandals`) before reporting.

## Playable build

Every commit that changes the game must be a meaningful improvement in a working state that I can start and test. There is no build step: the build is `index.html` and its files.

- Before committing, open the game in a browser, run a bout to the end, and check the console for errors.
- Don't commit half-finished or broken work.
- After committing, give me the commit hash, the command that starts the game (`open index.html` from the project folder), and what to try.
- If you couldn't run the game, say so and don't call the commit tested.

## Ideas backlog

`ideas.md` lists improvement ideas with an impact (1–5), an estimated token cost and a score (impact per 10k tokens), sorted best first.

- When you notice a good idea while working, add it to `ideas.md` with its impact, estimated tokens and score, and keep the table sorted by score.
- When asked what to do next, start from the top of `ideas.md`.
- Remove an idea in the commit that implements it.

## Subagents

- Work in the primary agent by default.
- Use one read-only subagent only when I ask, or to review a risky change to combat logic (timing, hit detection, resources). Give it the diff and a specific question.
- Don't run parallel agents that edit code.

## Arena art direction

The arena leans gory. Use stylized blood at the point of impact, stains on the sand and occasional bloody weapon-specific finishes. Keep injuries readable at the normal arena camera distance. Reserve severing for rare or signature executions. Keep the violence brief and leave anatomical close-ups and prolonged suffering out of the presentation. A heavy weapon should visibly shift the opponent’s weight in the direction of the blow.
