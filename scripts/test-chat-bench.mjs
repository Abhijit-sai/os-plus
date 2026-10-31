import { test } from "node:test";
import { runBenchCase } from "./chat-bench/run.mjs";
import { benchCases } from "./chat-bench/fixtures.mjs";
for (const fixture of benchCases)
  test(
    "CH10 offline bench: " + fixture.brand + "/" + fixture.name,
    async () => {
      await runBenchCase(fixture);
    },
  );
