// Deterministic optimistic completion ledger. The server must independently enforce
// UNIQUE(account_id, event_id) and award XP transactionally before confirming.
export const CYCLE_CAP = 3900;
export function eventId(kind, weekKey, slot) {
  if (!['mission','quest'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || !/^[a-zA-Z0-9_-]{1,64}$/.test(String(slot))) throw new Error('Invalid completion identity');
  return `${kind}:${weekKey}:${slot}`;
}
export function recordCompletion(ledger, event) {
  if (!Array.isArray(ledger)) throw new TypeError('Ledger must be an array');
  if (!event || typeof event.id !== 'string' || !event.id || !Number.isSafeInteger(event.xp) || event.xp <= 0 || event.xp > 50 || !['mission','quest'].includes(event.kind) || typeof event.skill !== 'string' || !event.skill || !Number.isInteger(event.cycle) || event.cycle < 0 || event.cycle > 5) throw new Error('Invalid completion event');
  if (ledger.some(x=>x.id===event.id)) return {events:ledger,added:false};
  return {events:[...ledger,{...event,status:'pending'}],added:true};
}
export function reconcile(ledger, acknowledgements) {
  const ack = new Map(acknowledgements.map(a=>[a.id,a.status]));
  return ledger.map(e=> ack.get(e.id)==='confirmed'?{...e,status:'confirmed'}:ack.get(e.id)==='rejected'?{...e,status:'rejected'}:e);
}
export function totals(ledger, cycle=0) {
  const accepted=ledger.filter(e=>e.status!=='rejected');
  const unique=new Map();
  for(const e of accepted) if(!unique.has(e.id)) unique.set(e.id,e);
  const skills={};let xp=0;
  for(const e of unique.values()) {skills[e.skill]=(skills[e.skill]||0)+e.xp;if(e.cycle===cycle)xp+=e.xp;}
  return {cycleXp:Math.min(CYCLE_CAP,xp),skillXp:skills,pending:[...unique.values()].filter(e=>e.status==='pending').length};
}
export function pendingEvents(ledger){return ledger.filter(e=>e.status==='pending');}
