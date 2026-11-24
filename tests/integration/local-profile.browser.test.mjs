import { test } from '@playwright/test';

test('local profile handles concurrent initialization and transaction abort', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(async () => {
    const { openLocalDatabase } = await import('/src/storage/local-database.mjs');
    const { getOrCreateLocalProfile } = await import('/src/storage/local-profile-repository.mjs');

    function check(condition, message) {
      if (!condition) throw new Error(message);
    }

    function readProfiles(database) {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction('profiles', 'readonly');
        const request = transaction.objectStore('profiles').getAll();

        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
      });
    }

    async function withTemporaryDatabase(test) {
      const name = `test-local-profile-${crypto.randomUUID()}`;
      const factory = {
        open: (_name, version) => indexedDB.open(name, version),
      };

      const connections = [];

      async function connect() {
        const database = await openLocalDatabase(factory);
        connections.push(database);
        return database;
      }

      try {
        await test(connect);
      } finally {
        for (const database of connections) database.close();

        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(
            new Error(`Temporary database cleanup blocked: ${name}`),
          );
        });
      }
    }

    async function testIndependentConnections() {
      await withTemporaryDatabase(async connect => {
        const firstConnection = await connect();
        const secondConnection = await connect();

        let generated = 0;

        const createId = () => {
          generated++;
          return crypto.randomUUID();
        };

        const [first, second] = await Promise.all([
          getOrCreateLocalProfile(firstConnection, createId),
          getOrCreateLocalProfile(secondConnection, createId),
        ]);

        check(first.id === second.id, 'Connections returned different profiles');
        check(generated === 1, 'Initialization generated multiple identifiers');

        const records = await readProfiles(firstConnection);

        check(records.length === 1, 'Expected exactly one stored profile');
        check(records[0].id === first.id, 'Returned profile was not persisted');
      });
    }

    async function testAbortAfterWrite() {
      await withTemporaryDatabase(async connect => {
        const database = await connect();
        let stagedWriteObserved = false;

        // Instrument real IndexedDB: abort after reading back the pending write.
        const abortingConnection = {
          transaction(...args) {
            const transaction = database.transaction(...args);
            const nativeObjectStore = transaction.objectStore.bind(transaction);

            Object.defineProperty(transaction, 'objectStore', {
              value(name) {
                const store = nativeObjectStore(name);

                return {
                  getAll: () => store.getAll(),
                  add(profile) {
                    const request = store.add(profile);

                    request.addEventListener('success', () => {
                      const readBack = store.get(profile.id);

                      readBack.addEventListener('success', () => {
                        stagedWriteObserved =
                          readBack.result?.id === profile.id;
                        transaction.abort();
                      });
                    });

                    return request;
                  },
                };
              },
            });

            return transaction;
          },
        };

        let failure;

        try {
          await getOrCreateLocalProfile(abortingConnection);
        } catch (error) {
          failure = error;
        }

        check(stagedWriteObserved, 'Abort did not occur after a readable write');
        check(
          failure?.message === 'Local profile transaction aborted',
          'Aborted initialization did not report the expected failure',
        );

        const records = await readProfiles(database);
        check(records.length === 0, 'Aborted profile remained stored');

        const recovered = await getOrCreateLocalProfile(database);
        const saved = await readProfiles(database);

        check(saved.length === 1, 'Retry did not persist exactly one profile');
        check(saved[0].id === recovered.id, 'Retry returned an unsaved profile');
      });
    }

    async function runLocalProfileBrowserTests() {
      await testIndependentConnections();
      console.log('PASS: independent connections persist exactly one profile');

      await testAbortAfterWrite();
      console.log('PASS: executed write rolls back and retry succeeds');
    }

    await runLocalProfileBrowserTests();
  });
});
