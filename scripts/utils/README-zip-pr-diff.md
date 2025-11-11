# PR diff zipper

Creates a zip file of changed files between two git refs. Skips heavy folders and build artifacts. Includes MANIFEST.txt with git info and checksums.

## Usage

Use defaults

```bash
npm run zip:pr
```

Explicit refs

```bash
npm run zip:pr -- --base origin/main --head HEAD
```

Since last tag

```bash
npm run zip:pr -- --since $(git describe --tags --abbrev=0)
```

## Output path

```
scripts/temp/pr-diff-<branch>-<shorthead>-<timestamp>.zip
```

## Ignored by default

- node_modules
- dist build coverage .next .nx .turbo out tmp temp
- scripts/temp
- dotfiles and .map .log .lock

## `.gitignore` addition

```
scripts/temp/
```

## Acceptance checklist

1. `npm i` installs archiver and picocolors.
2. `npm run zip:pr` produces a zip under `scripts/temp/`.
3. `unzip -l` shows only repo files you changed and MANIFEST.txt.
4. Flags work: `--base`, `--head`, `--since`.
5. Deleted files are not included. Renames are included by new path.

## Optional CI example

Add a job step in your PR workflow:

```yaml
- name: Create PR diff zip
  run: npm run zip:pr -- --base origin/main --head HEAD
- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    name: pr-diff-zip
    path: scripts/temp/*.zip
```
