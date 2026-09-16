import fs from "node:fs";
import { describe, expect, it } from "vitest";

import { SHARED_MODULES, renderShared, sharedTargetPath } from "../scripts/sync-edge-shared";

/**
 * The Edge Functions cannot import from `src/`, so the hash module exists in
 * two places. If they drift, the Edge Function writes digests the application
 * cannot verify - every session would silently fail its own integrity check,
 * which is precisely the failure this platform must never have.
 *
 * This test makes that drift a build failure instead.
 */
describe("shared Edge Function modules", () => {
  for (const mod of SHARED_MODULES) {
    it(`${mod.to} matches ${mod.from}`, () => {
      const target = sharedTargetPath(mod.to);

      expect(
        fs.existsSync(target),
        `${target} is missing. Run \`npm run edge:sync\`.`,
      ).toBe(true);

      expect(
        fs.readFileSync(target, "utf8"),
        `${target} has drifted from ${mod.from}. Run \`npm run edge:sync\`.`,
      ).toBe(renderShared(mod.from));
    });
  }
});
