#!/usr/bin/env bash
set -e

# Run all verification steps
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test:run
npm run test:verify
node bin/nextforge.js --help > /dev/null

# Run doctor and allow warnings (exit code 1) but fail on errors (exit code 2+)
node bin/nextforge.js doctor
DOCTOR_EXIT=$?

if [ $DOCTOR_EXIT -eq 0 ] || [ $DOCTOR_EXIT -eq 1 ]; then
  echo ""
  echo "✅ All verification checks passed!"
  exit 0
else
  echo ""
  echo "❌ Doctor found critical failures (exit code $DOCTOR_EXIT)"
  exit $DOCTOR_EXIT
fi
