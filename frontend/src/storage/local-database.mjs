const DATABASE_NAME = 'toadstool-atelier';

// Version 1 was used in the earlier schema proposal.
// Version 2 also supports databases created from that example.
const DATABASE_VERSION = 2;

export function openLocalDatabase(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      const stores = [
        ['profiles', 'id'],
        ['progression', 'ownerId'],
        ['images', 'key'],
        ['galleryEntries', 'id'],
        ['atelierUnlocks', ['ownerId', 'unlockId']],
        ['customizations', ['ownerId', 'slotId']],
      ];

      for (const [name, keyPath] of stores) {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, { keyPath });
        }
      }

      const images = request.transaction.objectStore('images');

      if (!images.indexNames.contains('owner')) {
        images.createIndex('owner', 'owner');
      }
    };

    request.onblocked = () => {
      console.warn(
        'Database upgrade blocked. Close other application tabs.',
      );
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Cannot open local database'));
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => database.close();

      resolve(database);
    };
  });
}