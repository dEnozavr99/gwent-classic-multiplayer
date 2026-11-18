# Workflow

Branches, commits and pull requests for code work. Docs-only planning commits follow the exception at the end.

## Vocabulary

- **Story**: a GitHub issue labelled `story`. It is the spec of one phase of ADR 0002 and the parent of that phase's tickets.
- **Ticket**: an implementation slice (`wayfinder:task`), a sub-issue of a story.
- **Map**: issue #1, the root of stories and decision tickets.
- A **standalone ticket** has no story (a spike, a doc). It branches off `develop` and its PR targets `develop`.

## Branches

- `main` carries releases only; GitHub Pages deploys from it. `develop` is the default branch and carries active development.
- Story branch: `story/<story#>-<slug>`, cut from `develop`.
- Ticket branch: `<type>/<ticket#>-<slug>`, cut from its story branch. `<type>` is a Conventional Commits type, e.g. `feat/15-shared-rng`.
- Stories run in sequence. Cut a story branch only after the stories holding its blockers have merged into `develop`. Inside a story, respect the native blocking links between tickets.
- Pull requests: ticket -> its story branch; story -> `develop` once every ticket is merged; `develop` -> `main` when the maintainer calls a release.
- Merge with merge commits at every level, so gradual commits and PR structure survive. Squash is disabled in the repo.

## Doing a ticket

1. Pick an unassigned ticket with no open blocker in the active story, and claim it: `gh issue edit <n> --add-assignee @me`.
2. Update the story branch (`git switch story/... && git pull --ff-only`), create the story branch from `develop` and push it if this is the story's first ticket, then cut the ticket branch from it.
3. Work in gradual commits (see Commits). Done when every acceptance criterion in the ticket is demonstrably met and every check that exists is green.
4. Push the ticket branch and open the PR against the story branch. Write the body with the `pr` skill: what and why, the acceptance criteria as a checklist, `Refs #<ticket>`.
5. Run the reviewer on the PR (see Review). Fix its findings, then post its summary as a PR comment.
6. Stop. The maintainer merges. Then close the ticket by hand with a link to the PR: closing keywords fire only on merges into the default branch.

## Finishing a story

When every ticket is merged into the story branch, open the story PR against `develop`. Its body summarises the story and lists `Closes #<ticket>` for each ticket and `Closes #<story>`, so merging into the default branch closes them all. Run the reviewer over the whole story diff first. Delete merged branches.

## Commits

- Conventional Commits 1.0: `type(scope): subject`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`, `style`. Scopes name the area: `tooling`, `core`, `ui`, `legacy`, `e2e`, `protocol`, `deploy`, `docs`. A breaking change takes `!`.
- Subject: imperative, at most 72 characters. Body: why, not what.
- One logical change per commit, and a ticket spans several. Tests land with or before the code they cover. Each commit leaves every existing check green.
- Footer on every commit: `Refs #<ticket>`, then the `Co-Authored-By` trailer the harness supplies.
- Pushed history stays as it is. An unpushed commit that dumps a whole ticket gets re-cut into gradual commits.

## Authority

- Agents claim tickets, create and push story and ticket branches, and open pull requests.
- The maintainer merges every pull request.
- Agents write to `develop`, `main` and story branches only through merged pull requests.

## Review

Each PR gets a reviewer pass when it is opened: the `code-review` skill, checking Standards and Spec against the ticket (or story) and the ADRs. Standards anchors, which keep the code from tangling:

- Layers depend one way: `src/core` (DOM-free) <- `src/ui` <- `legacy/`.
- `legacy/` changes only as the ticket says, with the minimum edit; no formatter or linter runs over it.
- The `Controller` seam stays Promise-based.
- Each commit is one logical change, and tests accompany behaviour.

## Environments

Pages publishes from `main` only. `develop` runs locally with `pnpm dev`. A repository has one Pages site (not verified); a `develop` preview would have to live under a subpath of that site, built together with `main`.

## Docs-only exception

Planning artifacts (`GLOSSARY.md`, `docs/adr/`, `docs/agents/`, `AGENTS.md`) go straight to `develop` as small `docs(...)` commits. Anything under `src/`, `legacy/`, `tests/`, `public/` or the build configuration goes through the story and ticket flow.
