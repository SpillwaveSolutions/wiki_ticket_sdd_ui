// CLI shim: print a fresh fixture repo path for Rust parity tests.
// Usage: npx tsx server/test/build-fixture.ts
import { buildFixtureRepo } from "./fixture.js";
console.log(buildFixtureRepo());
