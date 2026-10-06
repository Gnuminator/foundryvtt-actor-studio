# Fork sync: pulling an upstream Actor Studio release

This fork (`Gnuminator/foundryvtt-actor-studio`) carries a few fixes on top of upstream
(`geoidesic/foundryvtt-actor-studio`) in the branch `aitool/fixes`. Remotes: `origin` is the fork,
`upstream` is geoidesic. Nothing is ever pushed to `upstream`, and we open no issues or pull requests there.

Our commits on top of upstream 2.10.5 (one fix each, so a rebase conflict is easy to place):

1. jQuery selector error on advancement dialogs (`src/hooks/captureAdvancement.js`)
2. Doubled `black-parchment.webp` path (`src/components/organisms/dnd5e/Tabs/Advancements.svelte`)
3. Usage tracking off by default (`src/settings/index.ts`, `src/app/WelcomeAppShell.svelte`)
4. Subclass recorded on the class's Subclass advancement (`src/hooks/recordSubclassAdvancement.js`, `src/index.js`)
5. New and levelled-up heroes start with full spell slots (`src/helpers/fillSpellSlots.js`, `src/helpers/WorkflowStateMachine.js` at creation, `src/helpers/LevelUpStateMachine.js` at level-up, one or many levels and multiclass; added in 2.10.5-aitool.2)
6. Fork version, URLs and README notes (`module.json`, `package.json`, `README.md`)
7. Rebuilt tracked `dist/style.css`

When upstream fixes one of these itself, drop our commit during the rebase (`git rebase -i` is not
available in some of our shells; use `git rebase --onto` or `git cherry-pick` of the commits we keep).

## Steps

Use the portable Node 22 first on PATH (see the AI Tool repo notes). Upstream ships `bun.lock` and
`yarn.lock` but no `package-lock.json`, so install with npm like this:

```
git fetch upstream --tags
git checkout aitool/fixes
git rebase <new-upstream-tag>          # for example: git rebase 2.10.6
npm install --no-package-lock --legacy-peer-deps
npx vitest run                         # upstream's own tests plus ours; all must pass
npm run build                          # vite build, writes dist/
```

Before `npm run build`, delete every file in `dist/` except the tracked `style.css`, or older hashed chunks end up in
the copy. Test-kit build folders are kept per version (`2.10.5-aitool.1`, `2.10.5-aitool.2`); never edit an old one.
Fork counter: `.1` the first fixes, `.2` the level-up spell slot fill. A new fork fix raises it; a new upstream base
resets it to 1.

Then:

1. Set the version in `module.json` and `package.json` to `<upstream version>-aitool.1`
   (the counter restarts at 1 for each new upstream base; it grows for our own later fixes).
   Keep `id` as `foundryvtt-actor-studio`, keep the fork's `url`, `manifest` and `download`.
   A rebase onto a new upstream release overwrites these lines with upstream's, so check them.
2. Commit `dist/style.css` if the build changed it (it is the one tracked file under `dist/`).
3. Copy the module folder as Foundry installs it into the test kit folder:
   `module.json LICENSE index.js dist templates lang assets` into
   `C:\FoundryTest\test-kit\actor-studio-fork\<version>\`.
4. Install that folder on the TEST server first (copy to
   `C:\FoundryTest\data\Data\modules\foundryvtt-actor-studio`, restart the world) and run the test kit's
   `heroes-studio` scenario (`npm run kit -- ...`, see `docs/dev/TEST-KIT.md` in the AI Tool repo, section
   heroes-studio). Compare the report with `scripts/test-kit/data/studio-expected.json`: a finding that is
   not on the list, or that changed kind, fails the run. Remove entries from the list that a fix now
   resolves, and add new ones only after looking at why.
5. Only when the scenario is clean, install on the real server.
6. `git push --force-with-lease origin aitool/fixes` (a rebase rewrites the branch; this is our fork, not upstream).

A GitHub release on the fork (tag `<version>`, for example `2.10.6-aitool.1`) is what makes the
`manifest` and `download` URLs in `module.json` work. Creating tags and releases needs the owner's OK.
The workflow in `.github/workflows/main.yml` builds `module.zip` on a published release.

## Things to re-check after each upstream release

- Did upstream fix any of the bugs above? Then drop our commit.
- Does `module.json` `compatibility` still cover the Foundry version in use (verified 14)?
- The setting `usage-tracking` must still default to `false`.
- Human size step: dnd5e's own advancement dialog lists Small before Medium, so heroes come out Small
  unless the player picks Medium. We have not changed this (see the final report of the fork work).
