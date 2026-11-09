import {createGalleryCloudRestoration} from './supabase-artwork-restoration.mjs';
import {browserArtworkVault} from './artwork-vault-session.mjs';
import { setupCompletionBridge } from './completion-bridge.js';
import { setupArtworkQueue } from './artwork-queue.js';
// Cloud authentication layer. The app deliberately keeps browser-local progress
// until a separate, user-approved artwork migration and sync flow is built.
const $ = id => document.getElementById(id);
const message = (text, error = false) => {
  $('cloudMessage').textContent = text;
  $('cloudMessage').classList.toggle('error', error);
};
const buttonIds = ['emailSignIn','googleSignIn'];
function disableSignIn(disabled) { for (const id of buttonIds) $(id).disabled = disabled; }
// The optional local file is intentionally untracked. Keep its specifier dynamic:
// a literal import is resolved by Rollup even with @vite-ignore in a build.
const localConfigPath = './config.js';
let config;
try { config = await import(/* @vite-ignore */ localConfigPath); } catch {
  message('Cloud sign-in is not configured yet. See cloud/README.md for setup instructions.');
  disableSignIn(true);
}
if (config) {
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = config;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url || '') || !key || key.startsWith('YOUR_')) {
    message('Cloud configuration is incomplete. Update cloud/config.js.', true);
    disableSignIn(true);
  } else {
    try {
      // Load the official browser SDK. Requires network access when hosted.
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } });
      // Legacy profile snapshot sync is disabled: it can overwrite authoritative XP.
      let displayedAccount = undefined;
      const completions = setupCompletionBridge(supabase);
      const deletePanel = $('cloudDeletePanel');
      const deleteInput = $('cloudDeleteConfirmation');
      const deleteButton = $('cloudDeleteConfirm');
      const artworkQueue = setupArtworkQueue(supabase);
      const restoreVault=browserArtworkVault();
      const galleryRestore=createGalleryCloudRestoration({
        supabase,vault:restoreVault,
        getAccount:()=>displayedAccount,
        getState:()=>window.pahGalleryState?.read?.(),
        commit:(owner,next)=>window.pahGalleryState.commit(owner,next)
      });
      let restoreGeneration=0;
      window.addEventListener('pah:gallery-vault-ready',()=>{
        const owner=displayedAccount,version=restoreGeneration;
        if(!owner||!window.pahGalleryState)return;
        void galleryRestore.restore().then(report=>{
          if(version===restoreGeneration&&report.failed.length)console.warn('Some cloud artwork will retry later',report.failed);
        }).catch(error=>console.warn('Cloud gallery restoration deferred',error));
      });

      function showSession(session) {
        const nextAccount = session?.user?.id ?? null;
        if (nextAccount !== displayedAccount) {
          displayedAccount = nextAccount;
          restoreGeneration++;
          void galleryRestore.session(nextAccount);

          window.dispatchEvent(new CustomEvent('pah:account-changed', { detail: { accountId: nextAccount } }));
        }
        // Completion events sync through the account-scoped ledger only.
        completions.session(session);
        void artworkQueue.session(session);
        const signedIn = !!session?.user;
        deletePanel.classList.add('auth-hidden');
        deleteInput.value = '';
        deleteButton.disabled = true;
        $('cloudSignedOut').classList.toggle('auth-hidden', signedIn);
        $('cloudSignedIn').classList.toggle('auth-hidden', !signedIn);
        $('cloudBadge').textContent = signedIn ? 'Signed in · offline sync' : 'Account ready';
        $('cloudUser').textContent = session?.user?.email || 'Signed in';
        $('cloudIntro').textContent = signedIn
          ? 'Your progress works offline and syncs when connected. New proof and inspiration images are queued for private cloud upload; local gallery display remains device-specific.'
          : 'Sign in with a secure email link or Google. Existing local progress will not be overwritten.';
      }
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      showSession(session);
      supabase.auth.onAuthStateChange((_event, nextSession) => showSession(nextSession));
      $('emailSignIn').addEventListener('click', async () => {
        const email = $('cloudEmail').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return message('Enter a valid email address.', true);
        disableSignIn(true);
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
        disableSignIn(false);
        message(error ? error.message : 'Check your inbox for a secure sign-in link.', !!error);
      });
      $('googleSignIn').addEventListener('click', async () => {
        disableSignIn(true);
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
        if (error) { disableSignIn(false); message(error.message, true); }
      });
      $('cloudDeleteOpen').addEventListener('click', () => { deletePanel.classList.remove('auth-hidden'); deleteInput.value = ''; deleteButton.disabled = true; deleteInput.focus(); });
      $('cloudDeleteCancel').addEventListener('click', () => { deletePanel.classList.add('auth-hidden'); deleteInput.value = ''; });
      deleteInput.addEventListener('input', () => { deleteButton.disabled = deleteInput.value !== 'DELETE'; });
      deleteButton.addEventListener('click', async () => {
        if (deleteInput.value !== 'DELETE') return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return message('Sign in again before deleting your account.', true);
        deleteButton.disabled = true;
        message('Deleting your private cloud artwork and account…');
        try {
          const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'DELETE' } });
          if (error || !data?.deleted) throw new Error(data?.error || error?.message || 'Deletion could not be completed.');
          // Keep local data intact rather than risk erasing another account's browser state.
          await supabase.auth.signOut({ scope: 'local' });
          deletePanel.classList.add('auth-hidden');
          message('Cloud account deleted. Local browser data was not deleted.');
        } catch (err) { message('Deletion was not completed: ' + err.message, true); deleteButton.disabled = false; }
      });
      $('cloudSignOut').addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        message(error ? error.message : 'Signed out. Browser-local progress is unchanged.', !!error);
      });
    } catch (err) { message('Could not initialize cloud sign-in: ' + err.message, true); disableSignIn(true); }
  }
}
