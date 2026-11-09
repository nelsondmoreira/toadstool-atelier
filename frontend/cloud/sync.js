// Pocket Art Helper v0.4: account-scoped offline progress synchronization.
// Does not sync embedded base64 artwork; artwork needs the private storage uploader.
const STATE_KEY = 'pocket-art-helper-demo-v2';
const QUEUE_KEY = 'pah-sync-pending';
const $ = id => document.getElementById(id);
const note = (message, isError=false) => {
  const node = $('cloudSyncMessage'); if (node) { node.textContent = message; node.classList.toggle('error', isError); }
};
const cleanState = state => {
  // Large base64 images must never enter a Postgres JSON snapshot.
  const copy = structuredClone(state);
  delete copy.gallery;
  delete copy.custom;
  delete copy.questProof;
  for (const value of Object.values(copy.atelierDone || {})) if (value && typeof value === 'object') delete value.proof;
  return copy;
};
const getState = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch { return {}; } };
const keyFor = user => `pah-cloud-base:${user.id}`;
const pendingFor = user => `${QUEUE_KEY}:${user.id}`;
const mergeState = (remote, local) => {
  // Monotonic progress, and union of completions. Never decrease skill XP.
  const out = {...remote, ...local};
  out.totalXp = Math.max(remote.totalXp || 0, local.totalXp || 0);
  out.prestige = Math.max(remote.prestige || 0, local.prestige || 0);
  out.skillXp = {...remote.skillXp};
  for (const [skill, xp] of Object.entries(local.skillXp || {})) out.skillXp[skill] = Math.max(xp || 0, out.skillXp[skill] || 0);
  out.atelierDone = {...remote.atelierDone, ...local.atelierDone};
  out.achievements = [...new Map([...(remote.achievements || []), ...(local.achievements || [])].map(a => [a.name, a])).values()];
  // Week identity is part of a mission set; don't merge different weeks.
  if (remote.weekKey === local.weekKey) {
    const remoteMissions = remote.missions || [];
    out.missions = (local.missions || []).map((m, i) => ({...m, done: !!(m.done || remoteMissions[i]?.done)}));
    out.questDone = !!(remote.questDone || local.questDone);
  } else if ((remote.weekKey || '') > (local.weekKey || '')) {
    for (const k of ['weekKey','missions','quest','questDone']) out[k] = remote[k];
  }
  return out;
};
export function setupSync(supabase) {
  let user = null, busy = false, debounce;
  const status = () => {
    if (!user) return;
    const pending = localStorage.getItem(pendingFor(user)) === '1';
    note(pending ? 'Changes saved on this device · waiting to sync' : 'Progress synced with your account');
  };
  async function pull() {
    if (!user) return;
    const {data,error} = await supabase.from('artist_profiles').select('state').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data?.state || null;
  }
  async function push() {
    if (!user || busy || !navigator.onLine) { status(); return; }
    busy = true;
    try {
      const local = cleanState(getState());
      const remote = await pull();
      // If the account already has data, use the account as the source of truth
      // unless this device has a pending change from the same signed-in user.
      const pending = localStorage.getItem(pendingFor(user)) === '1';
      const knownAccount = localStorage.getItem(keyFor(user)) === '1';
      if (remote && !pending && !knownAccount) {
        localStorage.setItem(STATE_KEY, JSON.stringify({...getState(), ...remote}));
        localStorage.setItem(keyFor(user), '1');
        note('Account progress loaded. Refresh to display it.');
        return;
      }
      const state = remote ? mergeState(remote, local) : local;
      const {error} = await supabase.from('artist_profiles').upsert({user_id:user.id,state,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if (error) throw error;
      localStorage.removeItem(pendingFor(user));
      localStorage.setItem(keyFor(user), '1');
      status();
    } catch (err) { note('Saved offline. Cloud sync will retry: '+err.message, true); }
    finally { busy = false; }
  }
  function changed() {
    if (!user) return;
    localStorage.setItem(pendingFor(user),'1');
    note('Saved locally · syncing when possible');
    clearTimeout(debounce); debounce = setTimeout(push, 900);
  }
  window.addEventListener('pah:state-changed', changed);
  window.addEventListener('online', push);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) push(); });
  return {
    async session(session) {
      const next = session?.user || null;
      if (next?.id === user?.id) return;
      user = next;
      if (!user) { note('Sign in to synchronize progress. Local progress remains on this device.'); return; }
      note('Connecting to your private cloud profile…');
      await push();
    },
    syncNow: push,
  };
}
