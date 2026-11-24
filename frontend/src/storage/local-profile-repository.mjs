const PROFILE_ID_PATTERN =
  /^local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getOrCreateLocalProfile(
  database,
  createId = () => globalThis.crypto.randomUUID(),
) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('profiles', 'readwrite');
    const store = transaction.objectStore('profiles');

    let profile;
    let failure;

    transaction.oncomplete = () => resolve(profile);

    transaction.onabort = () => {
      reject(
        failure ??
        transaction.error ??
        new Error('Local profile transaction aborted'),
      );
    };

    const request = store.getAll();

    request.onsuccess = () => {
      try {
        const profiles = request.result;

        if (profiles.length > 1) {
          throw new Error('Multiple profiles found; automatic selection stopped');
        }

        if (profiles.length === 1) {
          profile = profiles[0];

          if (!PROFILE_ID_PATTERN.test(profile.id)) {
            throw new Error('Invalid local profile; data was not changed');
          }

          return;
        }

        const id = `local-${createId()}`;

        if (!PROFILE_ID_PATTERN.test(id)) {
          throw new Error('Invalid generated profile identifier');
        }

        profile = { id };
        store.add(profile);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
  });
}