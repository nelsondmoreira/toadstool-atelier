// Conservative, resumable migration of pending plaintext uploads into an encrypted repository.
// Original queue rows are deliberately retained until an independent queue cutover is deployed.
// Never put a passphrase or decrypted bytes in persisted migration state.
export function createArtworkVaultMigration({queue, vault, readBytes}) {
  if (!queue || !vault || typeof queue.list !== 'function' || typeof vault.save !== 'function' || typeof vault.load !== 'function' || typeof readBytes !== 'function') throw Error('Invalid migration dependencies');
  let active = false;
  return {
    async stage(owner, passphrase, {onProgress = () => {}} = {}) {
      if (active) throw Error('Migration already running');
      if (typeof owner !== 'string' || !owner || typeof passphrase !== 'string' || !passphrase) throw Error('Account and unlock secret required');
      active = true;
      const report = {owner, staged: [], alreadyStaged: [], failures: []};
      try {
        const items = await queue.list(owner);
        for (const item of items) {
          if (item.owner !== owner) continue;
          try {
            if (!item.id || !item.mime || !item.blob) throw Error('Incomplete queue item');
            const bytes = await readBytes(item.blob);
            if (!(bytes instanceof Uint8Array) || !bytes.length) throw Error('Invalid image bytes');
            const existing = await vault.load(owner, item.id, passphrase);
            if (existing) {
              if (existing.mime !== item.mime || !equal(existing.bytes, bytes)) throw Error('Existing encrypted image differs from queued original');
              report.alreadyStaged.push(item.id);
            } else {
              await vault.save(owner, item.id, item.mime, bytes, passphrase);
              const checked = await vault.load(owner, item.id, passphrase);
              if (!checked || checked.mime !== item.mime || !equal(checked.bytes, bytes)) throw Error('Post-write verification failed');
              report.staged.push(item.id);
            }
          } catch (error) {
            report.failures.push({id: item.id, reason: String(error?.message || error)});
          }
          onProgress({processed: report.staged.length + report.alreadyStaged.length + report.failures.length, total: items.length});
        }
        return {...report, safeToCutover: report.failures.length === 0, originalsRetained: true};
      } finally { active = false; }
    }
  };
}
function equal(a,b) {return a.length === b.length && a.every((v,i)=>v===b[i]);}
