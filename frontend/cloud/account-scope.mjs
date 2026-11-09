// Account-specific browser state. The legacy demo key is intentionally not migrated
// into any signed-in account without an explicit, reviewed import workflow.
export const LEGACY_KEY = 'pocket-art-helper-demo-v2';
export const GUEST_KEY = 'pah:state:guest:v1';
export function stateKey(userId) {
  if (userId == null) return GUEST_KEY;
  if (typeof userId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) throw new TypeError('Invalid account identifier');
  return `pah:state:account:${userId}:v1`;
}
export function readScopedState(storage, userId, makeFresh) {
  const raw = storage.getItem(stateKey(userId));
  if (raw === null) return makeFresh();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid state');
    return Object.assign(makeFresh(), parsed);
  } catch {
    // Do not overwrite or erase a corrupted snapshot: allow manual recovery.
    throw new Error('Account data could not be read. Your saved data was not changed.');
  }
}
export function writeScopedState(storage, userId, state) {
  storage.setItem(stateKey(userId), JSON.stringify(state));
}
