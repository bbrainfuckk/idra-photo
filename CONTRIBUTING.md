# Contributing

1. Node 22.13+.
2. `npm install`, then `npm test`. It builds, then runs the unit, queue, and integration tests.
3. Keep the rules that make Idra what it is:
   - no image API clients, keys, or provider fallbacks
   - no runtime network requests or telemetry
   - stdout is MCP protocol only; log to stderr
   - every state change is transactional and idempotent
   - never claim a result that was not verified
4. Add a test for every behavior change. Crash and race cases are welcome.
5. Commits are signed off under the MIT license of this repository.
