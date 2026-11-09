// Pure helpers shared by the Edge Function and its tests.
export const CONFIRMATION = 'DELETE';
export function validateDeletionRequest(method, confirmation) {
  if (method !== 'POST') return { status: 405, error: 'Use POST.' };
  if (confirmation !== CONFIRMATION) return { status: 400, error: 'Type DELETE to confirm.' };
  return null;
}
export function isOwnedPath(userId, path) {
  return typeof userId === 'string' && userId.length > 0 && typeof path === 'string' && path.startsWith(`${userId}/`) && path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..' && !part.includes('\\'));
}
export function shouldDeleteAccount(storageFailures) {
  return storageFailures.length === 0;
}
