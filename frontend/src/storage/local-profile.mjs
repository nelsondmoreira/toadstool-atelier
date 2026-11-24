const LOCAL_PROFILE_KEY = 'pah:local-profile:v1';
const LOCAL_PROFILE_PATTERN =
  /^local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getLocalProfileId(storage, createId) {
  const stored = storage.getItem(LOCAL_PROFILE_KEY);

  if (stored !== null) {
    if (!LOCAL_PROFILE_PATTERN.test(stored)) {
      throw new Error('Local profile could not be read; data was not changed');
    }

    return stored;
  }

  const id = `local-${createId()}`;

  if (!LOCAL_PROFILE_PATTERN.test(id)) {
    throw new Error('Invalid local profile identifier');
  }

  storage.setItem(LOCAL_PROFILE_KEY, id);
  return id;
}