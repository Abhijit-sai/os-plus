import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapsPoint,
  whatsappLink,
  nearestBranch,
} from "../src/features/chat/actions/links.ts";
test("WhatsApp links contain only the configured number and exact convenience ref", () => {
  assert.equal(
    whatsappLink({ phone: "+919999990000", ref: "ABC23" }),
    "https://wa.me/919999990000?text=REF%3AABC23",
  );
  assert.throws(() => whatsappLink({ phone: "wrong", ref: "ABC23" }));
});
test("Maps coordinates are parsed without fetching; foreign, shortened and invalid coordinates are unavailable", () => {
  assert.deepEqual(mapsPoint("https://www.google.com/maps/@12.2,77.3,14z"), {
    lat: 12.2,
    lng: 77.3,
  });
  assert.deepEqual(mapsPoint("https://maps.google.com/?q=12.2,77.3"), {
    lat: 12.2,
    lng: 77.3,
  });
  for (const url of [
    "https://maps.app.goo.gl/xyz",
    "https://evil.invalid/maps/@12,77,14z",
    "https://www.google.com.evil.invalid/maps/@12,77,14z",
    "https://www.google.com/maps/@99,77,14z",
  ])
    assert.equal(mapsPoint(url), null);
});
test("one tenant-owned nearest or exact served branch is selected; unknown or tied location asks instead", () => {
  const tenantId = "60000000-0000-4000-8000-000000000001",
    brandId = "60000000-0000-4000-8000-000000000002";
  const make = (code, lat, lng) => ({
    tenantId,
    brandId,
    code,
    name: code,
    address: null,
    mapUrl: "https://maps.google.com/?q=" + lat + "," + lng,
    lat,
    lng,
    primary: false,
    default: false,
  });
  const locations = [make("near", 12, 77), make("far", 15, 78)],
    input = {
      tenantId,
      brandId,
      locations,
      point: null,
      area: null,
      areas: [],
    };
  assert.equal(nearestBranch(input), null);
  assert.equal(
    nearestBranch({ ...input, point: { lat: 12.01, lng: 77 } }).code,
    "near",
  );
  assert.equal(
    nearestBranch({
      ...input,
      area: "A",
      areas: [{ locationCode: "far", served: ["A"], postalCodes: [] }],
    }).code,
    "far",
  );
  assert.equal(
    nearestBranch({
      ...input,
      locations: [locations[0], { ...locations[0], code: "same" }],
      point: { lat: 12, lng: 77 },
    }),
    null,
  );
  assert.throws(() =>
    nearestBranch({
      ...input,
      locations: [{ ...locations[0], tenantId: brandId }],
    }),
  );
});
