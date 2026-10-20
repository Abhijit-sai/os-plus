// Identical SSR/browser output independent of machine locale and timezone.
// Pilot operating dates are shown explicitly in India time, not implicit locale.
const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function shopifyPilotTime(value:string){
  const instant=Date.parse(value);if(!Number.isFinite(instant))return "Date unavailable";
  const iso=new Date(instant+330*60*1000).toISOString();
  return `${iso.slice(8,10)} ${months[Number(iso.slice(5,7))-1]} ${iso.slice(0,4)}, ${iso.slice(11,16)} IST`;
}
