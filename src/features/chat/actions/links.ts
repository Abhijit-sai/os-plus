import { z } from "zod";
import { locationsSchema } from "../agent/background.ts";
const pointSchema = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
  })
  .strict();
/** Only embedded coordinates from known Maps hosts are read. Short links are never fetched. */
export function mapsPoint(raw: unknown) {
  const parsed = z.string().url().max(2048).safeParse(raw);
  if (!parsed.success) return null;
  const url = new URL(parsed.data);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    ![
      "maps.google.com",
      "www.google.com",
      "google.com",
      "maps.app.goo.gl",
      "goo.gl",
    ].includes(url.hostname)
  )
    return null;
  const match = (
    url.pathname +
    " " +
    (url.searchParams.get("q") ?? url.searchParams.get("query") ?? "")
  ).match(/(?:@|^|\s)(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:[,\s/]|$)/);
  if (!match) return null;
  const point = pointSchema.safeParse({
    lat: Number(match[1]),
    lng: Number(match[2]),
  });
  return point.success ? point.data : null;
}
export function whatsappLink(raw: unknown) {
  const x = z
    .object({
      phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
      ref: z.string().regex(/^[2-9A-HJKMNP-Z]{5}$/),
    })
    .strict()
    .parse(raw);
  return (
    "https://wa.me/" +
    x.phone.slice(1) +
    "?text=" +
    encodeURIComponent("REF:" + x.ref)
  );
}
export function nearestBranch(raw: unknown) {
  const x = z
    .object({
      tenantId: z.string().uuid(),
      brandId: z.string().uuid(),
      point: pointSchema.nullable(),
      area: z.string().max(2000).nullable(),
      locations: locationsSchema,
      areas: z
        .array(
          z
            .object({
              locationCode: z.string(),
              served: z.array(z.string()),
              postalCodes: z.array(z.string()),
            })
            .strict(),
        )
        .max(100),
    })
    .strict()
    .parse(raw);
  if (
    x.locations.some(
      (l) => l.tenantId !== x.tenantId || l.brandId !== x.brandId,
    )
  )
    throw new Error("Location scope mismatch");
  const options = x.locations.filter((l) => l.mapUrl);
  const exact = x.area
    ? options.filter((l) =>
        x.areas.some(
          (a) =>
            a.locationCode === l.code &&
            [...a.served, ...a.postalCodes].some(
              (value) =>
                value.trim().toLowerCase() === x.area!.trim().toLowerCase(),
            ),
        ),
      )
    : [];
  if (exact.length === 1) return exact[0];
  if (!x.point) return null;
  const rad = (n: number) => (n * Math.PI) / 180;
  const distance = (l: (typeof options)[number]) => {
    const a =
      Math.sin(rad(l.lat! - x.point!.lat) / 2) ** 2 +
      Math.cos(rad(x.point!.lat)) *
        Math.cos(rad(l.lat!)) *
        Math.sin(rad(l.lng! - x.point!.lng) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  };
  const ranked = options
    .filter((l) => l.lat !== null && l.lng !== null)
    .map((l) => ({ l, d: distance(l) }))
    .sort((a, b) => a.d - b.d);
  if (
    !ranked.length ||
    (ranked.length > 1 && Math.abs(ranked[0].d - ranked[1].d) < 0.001)
  )
    return null;
  return ranked[0].l;
}
