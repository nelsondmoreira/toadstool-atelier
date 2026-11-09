// Reconcile authoritative awards without losing newer local events or resurrecting
// server-rejected events. Composite keys include prestige cycle.
export const completionKey = e => `${e.cycle}:${e.id}`;
export function mergeAwards(local, awards, processed = []) {
  const byKey = new Map();
  for (const award of awards) byKey.set(completionKey(award), {...award,status:'confirmed'});
  const processedByKey = new Map(processed.map(e=>[completionKey(e),e]));
  for (const event of local) {
    const key=completionKey(event);
    if (byKey.has(key)) continue;
    const result=processedByKey.get(key);
    if (result?.status==='rejected') byKey.set(key,{...event,status:'rejected'});
    else if (result?.status==='confirmed') {
      // A confirmed RPC not reflected in the snapshot must be retried, not erased.
      byKey.set(key,{...event,status:'pending'});
    } else byKey.set(key,event);
  }
  return [...byKey.values()];
}
