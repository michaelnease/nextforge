# CI Maintenance Guide

This guide documents the CI/CD configuration and maintenance practices for nextforge.

## Current Configuration

### Workflow: `.github/workflows/ci.yml`

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main`

**Matrix Strategy:**

- Node.js versions: 18, 22
- OS: ubuntu-latest

### Test Pipeline Stages

1. **Lint** - ESLint checks
2. **Format** - Prettier checks
3. **Typecheck** - TypeScript compilation check
4. **Build** - Full TypeScript build
5. **Unit Tests** - Vitest test suite
6. **Smoke Tests** - `npm run smoke:add-component`
7. **CLI Tests** - Help and doctor commands
8. **Integration Test** - Real workspace test with add:page

### Performance Optimizations

#### npm Caching

```yaml
- uses: actions/setup-node@v4
  with:
    cache: "npm"
    cache-dependency-path: package-lock.json
```

**Impact**: Reduces install time from ~30s to ~5s on cache hit

**Cache Key**: Based on `package-lock.json` hash

- Cache invalidates when dependencies change
- Separate cache per Node version and OS

#### Parallel Matrix Jobs

- Node 18 and Node 22 tests run in parallel
- Total pipeline time: ~3-4 minutes per version

## GitHub Actions Version Management

### Current Action Versions

| Action               | Version | Latest Check                                               |
| -------------------- | ------- | ---------------------------------------------------------- |
| `actions/checkout`   | v4      | [Releases](https://github.com/actions/checkout/releases)   |
| `actions/setup-node` | v4      | [Releases](https://github.com/actions/setup-node/releases) |

### Version Pinning Strategy

**Current**: Major version pinning (`@v4`)

- ✅ Gets security updates automatically
- ✅ Gets bug fixes automatically
- ⚠️ May get breaking changes within major version

**Alternative**: SHA pinning (not currently used)

```yaml
# More secure but requires manual updates
uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

### Update Schedule

**Recommended**: Review every 3 months or when:

- Security advisories are published
- Breaking changes affect our usage
- New features would benefit the workflow

### How to Update

1. Check release notes at the GitHub repo
2. Review breaking changes
3. Test in a feature branch
4. Update version in workflow
5. Monitor first few runs

```bash
# Check current versions
grep -n "uses:" .github/workflows/ci.yml
```

## CLI Integration Test

### Purpose

Validates that the built CLI works in a clean environment, similar to end-user usage.

### Test Scenario

```bash
# Creates temp directory
# Sets up minimal Next.js structure
# Runs: nextforge add:page Example --app app
# Verifies: app/Example/page.tsx exists
```

### Why This Matters

- Tests the **built** binary, not source
- Uses actual filesystem operations
- Validates CLI flag parsing
- Ensures bin/dist linkage works

### Extending the Test

To add more commands:

```yaml
- name: CLI integration test
  run: |
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    # Setup
    mkdir -p app
    echo '{}' > package.json

    # Test multiple commands
    node "$GITHUB_WORKSPACE/bin/nextforge.js" add:page Example --app app
    node "$GITHUB_WORKSPACE/bin/nextforge.js" add:group auth --app app

    # Verify all outputs
    [ -f "app/Example/page.tsx" ] || exit 1
    [ -d "app/(auth)" ] || exit 1

    # Cleanup
    cd "$GITHUB_WORKSPACE"
    rm -rf "$TEMP_DIR"
```

## Troubleshooting

### Cache Issues

If caching causes problems:

```yaml
# Disable temporarily
- uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    # cache: "npm"  # commented out
```

Or clear cache manually:

- Go to Actions → Caches
- Delete relevant cache entries

### Integration Test Failures

**Debug steps:**

1. Check if CLI built successfully (previous step)
2. Verify temp directory creation works
3. Check file permissions
4. Review CLI error output

**Common issues:**

- Missing build artifacts → Ensure "Build project" step succeeded
- Permission errors → Check mktemp permissions on runner
- Command not found → Verify $GITHUB_WORKSPACE path resolution

### Node Version Compatibility

If tests fail on specific Node version:

1. Check Node.js changelog for breaking changes
2. Review package.json engines requirement
3. Test locally with nvm/volta
4. Consider updating tsconfig target if needed

## Monitoring

### Success Metrics

- ✅ All steps pass on both Node 18 and 22
- ✅ Total runtime < 5 minutes per job
- ✅ Cache hit rate > 80% (check Actions tab)

### Failure Response

1. Check which step failed
2. Review error messages
3. Test locally with same Node version
4. Check for flaky tests
5. Verify external dependencies (npm registry)

## Security Considerations

### Dependabot Updates

- Configured in `.github/dependabot.yml` (if present)
- Automatically opens PRs for action updates
- Review security advisories before merging

### Secrets

- No secrets currently required
- If added: Use GitHub Secrets, never hardcode
- Limit permissions to minimum required

### Supply Chain

- Use official GitHub actions only
- Review action source before adding new actions
- Consider SHA pinning for critical workflows

## Future Improvements

**Potential Additions:**

1. **Code Coverage** - Upload to Codecov/Coveralls
2. **Release Workflow** - Automated npm publishing
3. **Benchmark Tests** - Track performance over time
4. **E2E Tests** - Full Next.js app generation test
5. **Windows/macOS** - Multi-OS testing

**Performance:**

1. **Artifact Caching** - Cache dist/ between steps
2. **Conditional Steps** - Skip tests on docs-only changes
3. **Parallel Tests** - Split test suite into shards
