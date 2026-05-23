# Releasing the Desktop App

The desktop client is shipped as a Windows NSIS installer hosted on GitHub
Releases. Installed clients self-update on next launch (and hourly while
running) via `electron-updater`.

## The flow at a glance

```
bump version  →  tag commit  →  push tag  →  CI builds + uploads to DRAFT release  →  publish on GitHub  →  shops self-update
```

## Step-by-step

1. **Decide the version.** Semver — `MAJOR.MINOR.PATCH`.
   - Patch: bug fixes, UI polish, perf
   - Minor: backward-compatible features
   - Major: schema breaks, removed features, anything cashiers will notice

2. **Bump it.**

   ```sh
   # Edit apps/desktop/package.json -> "version": "X.Y.Z"
   git commit -am "release: vX.Y.Z"
   git tag vX.Y.Z
   git push --follow-tags
   ```

3. **Wait for CI.** GitHub Actions (`.github/workflows/release.yml`) runs
   on the tag push, builds the Windows installer + `latest.yml`, and
   uploads them to a **draft** release named `vX.Y.Z`.

4. **Smoke test the draft.** Download the `.exe` from the draft release,
   install it on a clean Windows box, ring up a test sale, confirm the
   receipt prints and the dashboard loads.

5. **Publish the release.** In the GitHub UI, edit the draft → "Publish
   release". Once published, every running client picks up the update on
   its next hourly check (or immediately on next launch).

## What ships in a release

- `Bread Faculty POS-Setup-X.Y.Z.exe` — full installer
- `latest.yml` — manifest the autoUpdater reads to detect new versions
- `Bread Faculty POS-Setup-X.Y.Z.exe.blockmap` — enables delta updates
  (subsequent updates download only the changed bytes, not the whole exe)

## Hotfix path

Need to ship before the next planned version?

1. Cherry-pick the fix to `main`
2. Bump patch version (e.g. `0.1.5 → 0.1.6`)
3. Same tag + push flow

Or trigger `release.yml` manually from the Actions tab via
`workflow_dispatch` — useful if you need to re-build a specific commit
without bumping the tag.

## Things to know

- **No code signing yet.** Windows SmartScreen will warn users on first
  install ("Microsoft Defender SmartScreen prevented…"). Right-click →
  "Run as administrator" or "More info → Run anyway". To remove the
  warning, buy an EV code signing cert (~$300/yr) and add it to the
  electron-builder config.
- **Updates only run in packaged builds.** `electron-vite dev` skips the
  `checkForUpdatesAndNotify` call entirely — no `app-update.yml`, no
  installer, nothing to update.
- **The draft release exists from the moment CI finishes.** Anyone with
  repo access can grab the artifacts to test before you publish.
- **`Impulse69` is case-sensitive in the publish config.** GitHub
  redirects mixed-case → canonical, but `electron-builder` builds the
  publish URL literally. Don't change the casing.
