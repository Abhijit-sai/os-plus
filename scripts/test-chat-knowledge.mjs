import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseKnowledgePack } from "../src/features/chat/knowledge-pack.ts";

const example = JSON.parse(
  readFileSync(
    new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
    "utf8",
  ),
);
test("a synthetic inquiry pack validates without inventing prices, booking or business facts", () => {
  const pack = parseKnowledgePack(example);
  assert.deepEqual(pack, example);
  assert.equal(pack.booking, undefined);
  assert.deepEqual(pack.prices, []);
});

test("unknown fields and unsafe links are rejected at every boundary", () => {
  for (const change of [
    (p) => {
      p.apiToken = "not-a-real-token";
    },
    (p) => {
      p.brand.tenantId = "untrusted";
    },
    (p) => {
      p.review = { url: "http://example.invalid", cooldownDays: 30 };
    },
    (p) => {
      p.priceListImageUrl = "https://user:pass@example.invalid/image";
    },
    (p) => {
      p.services[0].turnaround = { min: 5, max: 2, unit: "days" };
    },
    (p) => {
      p.style.maxQuestionsPerTurn = 2;
    },
    (p) => {
      p.locked.handoffLine = "Hello {{customer_name}}";
    },
  ]) {
    const pack = structuredClone(example);
    change(pack);
    assert.throws(() => parseKnowledgePack(pack));
  }
});
test("service and booking keys are unique and prices reference a declared service", () => {
  for (const change of [
    (p) => {
      p.services.push(structuredClone(p.services[0]));
    },
    (p) => {
      p.prices = [
        { serviceKey: "missing", label: "Example", amount: 1, unit: "item" },
      ];
    },
    (p) => {
      p.booking = {
        capability: "follow_up_task",
        windows: [
          { key: "am", label: "AM" },
          { key: "am", label: "Again" },
        ],
      };
    },
    (p) => {
      p.areas = [
        { locationCode: "A", served: [], postalCodes: [] },
        { locationCode: "a", served: [], postalCodes: [] },
      ];
    },
  ]) {
    const pack = structuredClone(example);
    change(pack);
    assert.throws(() => parseKnowledgePack(pack));
  }
});

test("publication requires the brand's own active branches and enabled capabilities", async () => {
  const { validateKnowledgePublication } =
    await import("../src/features/chat/knowledge-pack.ts");
  const pack = structuredClone(example);
  pack.areas = [
    { locationCode: "north", served: ["Example"], postalCodes: [] },
  ];
  assert.throws(() =>
    validateKnowledgePublication(pack, {
      locationCodes: ["south"],
      capabilities: [],
    }),
  );
  assert.deepEqual(
    validateKnowledgePublication(pack, {
      locationCodes: ["north"],
      capabilities: [],
    }),
    pack,
  );
  pack.booking = { capability: "laundry_pickup" };
  assert.throws(() =>
    validateKnowledgePublication(pack, {
      locationCodes: ["north"],
      capabilities: [],
    }),
  );
  assert.deepEqual(
    validateKnowledgePublication(pack, {
      locationCodes: ["north"],
      capabilities: ["laundry_pickup"],
    }),
    pack,
  );
});

test("optional CRM policy validates currency, value and tenant-defined intent priorities while older packs stay valid",()=>{
 const crm={intentPriorities:{question:1,booking:3},typicalBasket:{amount:250,currency:"INR"}};
 assert.deepEqual(parseKnowledgePack({...example,crm}).crm,crm);
 assert.throws(()=>parseKnowledgePack({...example,crm:{...crm,typicalBasket:{amount:-1,currency:"INR"}}}));
 assert.throws(()=>parseKnowledgePack({...example,crm:{...crm,intentPriorities:{bad:-1}}}));
});
