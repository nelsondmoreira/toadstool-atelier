/** Conflict policy: latest user-confirmed edit wins, not last upload to finish.
 * Confirmed timestamps are recorded when the user taps Save, persisted with the
 * offline job, and NEVER replaced with retry/upload time. Ties use operation ID.
 * Client clocks can be wrong; production should monitor clock skew and consider
 * server-issued logical timestamps for stricter cross-device guarantees.
 */
export function compareDesigns(a, b) {
  const ta = Date.parse(a.confirmedAt), tb = Date.parse(b.confirmedAt);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) throw new Error('Invalid confirmation timestamp');
  if (ta !== tb) return Math.sign(ta - tb);
  if (!a.operationId || !b.operationId) throw new Error('Operation ID required');
  return a.operationId.localeCompare(b.operationId);
}
export function resolveDesignConflict(current, incoming) {
  if (!incoming?.operationId || !incoming?.path || !incoming?.confirmedAt) throw new Error('Incomplete incoming design');
  if (!current) return {action:'apply', previousPath:null};
  if (current.operationId === incoming.operationId) return {action:'already-applied', previousPath:null};
  return compareDesigns(incoming,current)>0
    ? {action:'apply',previousPath:current.path}
    : {action:'superseded',previousPath:null,orphanPath:incoming.path};
}
/** Adapter.commit MUST implement the same decision atomically in the database.
 * Do not delete the current asset when an offline edit loses a conflict.
 */
export async function syncConfirmedDesign({owner,slot,job,adapter}) {
  if (!owner || !slot || !job?.operationId || !job?.confirmedAt) throw Error('Missing design metadata');
  await adapter.uploadIfNeeded(job);
  const result=await adapter.commitIfNewer({owner,slot,job});
  if (!['applied','already-applied','superseded'].includes(result.status)) throw Error('Unknown commit status');
  // The server transaction must enqueue cleanup of superseded files, including
  // losing uploads, and a worker must check all references before deletion.
  return result;
}
