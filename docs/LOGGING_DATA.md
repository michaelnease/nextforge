# Safe Data Introspection

NextForge includes safe data introspection to help debug command execution without accidentally leaking secrets in logs.

## Quick Start

Enable data logging with the `--log-data` flag:

```bash
# Summary mode (default) - 512 byte previews
npx nextforge doctor --log-data summary

# Full mode - 4096 byte previews for detailed debugging
npx nextforge add:page dashboard --log-data full

# Off mode - disable data logging
npx nextforge doctor --log-data off
```

You can also use the `NEXTFORGE_LOG_DATA` environment variable:

```bash
export NEXTFORGE_LOG_DATA=summary
npx nextforge doctor
```

## Example Output

### Summary Mode

```json
{
  "label": "inputs",
  "bytes": 119,
  "hash": "c5273f427c02d665",
  "preview": "{\n  \"command\": \"doctor\",\n  \"env\": {},\n  \"nodeVersion\": \"v22.19.0\",\n  \"platform\": \"linux-x64\",\n  \"runId\": \"[REDACTED]\"\n}",
  "msg": "Data: inputs"
}
```

### Full Mode Example

```bash
npx nextforge add:page settings --log-data full
```

This will log:

- `inputs` - Command execution context
- `template.vars:page` - Template generation variables
- `file.preview:page.tsx` - Generated file content preview
- `file.confirm:page.tsx` - File write confirmation with path, size, and hash

## Redaction

Sensitive data is automatically redacted by default:

**Redacted Keys:** password, secret, token, apiKey, authorization, credentials, etc.

**Redacted Patterns:** JWT tokens, AWS keys, credit cards, OAuth tokens, GitHub tokens, etc.

### Custom Redaction

Add extra keys to redact:

```bash
npx nextforge doctor --log-data summary --redact email,phone
```

### Disable Redaction (Local Dev Only)

⚠️ **WARNING:** Only use `--no-redact` in local development. Never use in CI or production.

```bash
npx nextforge doctor --log-data full --no-redact
```

## How It Works

1. **Automatic Redaction** - Sensitive keys and value patterns are automatically masked
2. **Size Limiting** - Previews are truncated to prevent log bloat
3. **Content Hashing** - SHA256 hashes allow verification without storing full content
4. **Byte Counting** - UTF-8 aware byte counting for accurate metrics

## Integration

Data logging is integrated at key boundaries with consistent labels:

- `inputs` - Command inputs and environment (from runCommand)
- `template.vars:*` - Template generation variables
- `file.preview:*` - Generated file content (respects mode)
- `file.confirm:*` - Post-write confirmation with path, bytes, hash
- `file.diff:*` - Compact diffs when updating existing files

## Performance

Data logging has negligible overhead:

- **Off mode:** Zero overhead
- **Summary mode:** < 1ms per log point
- **Full mode:** < 5ms per log point

Logs are written asynchronously and don't block command execution.
