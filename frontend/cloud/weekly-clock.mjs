// Pure weekly calendar and offline completion rules. No network dependencies.
export function validZone(zone) {
  try { new Intl.DateTimeFormat('en-US', {timeZone:zone}).format(0); return true; } catch { return false; }
}
export function mondayKey(at, zone) {
  if (!validZone(zone)) throw new RangeError('Invalid account time zone');
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid timestamp');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const weekdays={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
  const day=weekdays[parts.weekday];
  if(day===undefined) throw new Error('Unexpected weekday');
  const utc=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day));
  utc.setUTCDate(utc.getUTCDate()-day);
  return utc.toISOString().slice(0,10);
}
export function validateOfflineCompletion(event, {zone, existingIds=new Set(), receivedAt=Date.now(), maxFutureSkewMs=5*60_000}={}) {
  if (!event || typeof event.id!=='string' || !event.id.trim() || typeof event.weekKey!=='string') return {ok:false,reason:'invalid-event'};
  if(existingIds.has(event.id)) return {ok:false,reason:'duplicate'};
  const recorded=Date.parse(event.completedAt);
  if (!Number.isFinite(recorded)) return {ok:false,reason:'invalid-timestamp'};
  if(recorded>receivedAt+maxFutureSkewMs) return {ok:false,reason:'future-clock'};
  try {if(mondayKey(recorded,zone)!==event.weekKey) return {ok:false,reason:'expired-week'};}
  catch {return {ok:false,reason:'invalid-timezone'};}
  // A client clock can be backdated; this is a friendly single-player policy, not proof of real time.
  return {ok:true,reason:'accepted'};
}
export function mergeCompletionEvents(existing, incoming, options) {
  const merged=new Map(existing.map(e=>[e.id,e]));
  const rejected=[];
  for(const event of incoming){
    const verdict=validateOfflineCompletion(event,{...options,existingIds:new Set(merged.keys())});
    if(verdict.ok) merged.set(event.id,event); else rejected.push({id:event?.id,reason:verdict.reason});
  }
  return {events:[...merged.values()],rejected};
}
