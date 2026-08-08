import { LaundryCustodyClient } from "@/verticals/laundry/custody/laundry-custody-client";
import { getLaundryCustodyData } from "@/verticals/laundry/custody/queries";

export default async function LaundryCustodyPage() {
  const { context: _context, ...data } = await getLaundryCustodyData();

  return <LaundryCustodyClient {...data} />;
}
