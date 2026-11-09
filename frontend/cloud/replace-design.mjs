/** Safe, retryable custom-art replacement. Pure orchestration; adapter handles persistence. */
export async function replaceDesign({slot, file, owner, adapter}) {
  if (!owner || !slot || !file) throw new Error('Owner, slot and file are required');
  const operationId = adapter.newId();
  const path = `${owner}/atelier-design/${operationId}`;
  // Never delete or overwrite the current object before the pointer commits.
  await adapter.stage({operationId, owner, slot, path, file});
  try {
    await adapter.upload({path, file});
    const oldPath = await adapter.commit({owner, slot, path, operationId});
    // Once committed, cleanup must be retried independently, never roll back the new pointer.
    if (oldPath && oldPath !== path) {
      await adapter.scheduleCleanup({owner, slot, operationId, oldPath});
      try { await adapter.cleanup({owner, path:oldPath, operationId}); }
      catch (error) { await adapter.noteCleanupFailure({operationId, error:String(error)}); }
    }
    await adapter.complete({operationId});
    return {path, previousPath:oldPath ?? null};
  } catch (error) {
    // The old slot remains active if upload or commit fails. Staged blobs are recoverable.
    await adapter.noteFailure({operationId, error:String(error)});
    throw error;
  }
}
/** Cleanup jobs are idempotent and must verify the path is no longer referenced. */
export async function retryCleanup({adapter, job}) {
  if (await adapter.isReferenced(job.oldPath)) return {skipped:'still referenced'};
  await adapter.cleanup({owner:job.owner, path:job.oldPath, operationId:job.operationId});
  await adapter.finishCleanup(job.operationId);
  return {deleted:true};
}
