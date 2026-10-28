import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { rails, runtime } from "./common.mjs";
const mode = process.argv[2];
assert.ok(["before", "after", "restore"].includes(mode));
const before = path.join(runtime, "ch9-prechat-before.private.json"),
  after = path.join(runtime, "ch9-prechat-after.private.json");
const prefix =
  "i=Inbox.find(901);raise 'Wrong local account' unless i.account_id==901 && i.channel_type=='Channel::WebWidget';c=i.channel;";
const read = async () =>
  JSON.parse(
    (
      await rails(
        prefix +
          "puts 'CH9_FORM='+c.attributes.slice('pre_chat_form_enabled','pre_chat_form_options').to_json",
      )
    )
      .split("\n")
      .find((x) => x.startsWith("CH9_FORM="))
      .slice(9),
  );
if (mode === "before") {
  await writeFile(before, JSON.stringify(await read()), {
    flag: "wx",
    mode: 0o600,
  });
  console.log("Saved exact two-field local pre-chat baseline");
}
if (mode === "after") {
  const baseline = JSON.parse(await readFile(before));
  assert.equal(baseline.pre_chat_form_enabled, false);
  const current = await read();
  assert.equal(current.pre_chat_form_enabled, true);
  await writeFile(after, JSON.stringify(current), { flag: "wx", mode: 0o600 });
  console.log("Saved changed local pre-chat fingerprint");
}
if (mode === "restore") {
  const baseline = JSON.parse(await readFile(before)),
    expected = JSON.parse(await readFile(after));
  assert.deepEqual(
    await read(),
    expected,
    "Concurrent pre-chat change; do not overwrite",
  );
  await rails(
    prefix +
      "expected=JSON.parse(" +
      JSON.stringify(JSON.stringify(expected)) +
      ");prior=JSON.parse(" +
      JSON.stringify(JSON.stringify(baseline)) +
      ");c.with_lock{raise 'Concurrent local change' unless c.attributes.slice('pre_chat_form_enabled','pre_chat_form_options')==expected;c.update!(prior)};puts 'CH9_FORM_RESTORED'",
  );
  assert.deepEqual(await read(), baseline);
  console.log("PASS exact local pre-chat baseline restored");
}
