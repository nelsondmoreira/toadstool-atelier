import { mondayKey } from "../cloud/weekly-clock.mjs";
import { eventId, recordCompletion, totals, pendingEvents } from "../cloud/completion-ledger.mjs";
import { stateKey, readScopedState, writeScopedState } from '../cloud/account-scope.mjs';
import { createLegacyGalleryMigration } from '../cloud/gallery-legacy-migration.mjs';
import { createLegacyProofMigration } from '../cloud/legacy-proof-migration.mjs';
import { mountWeeklyProgress } from "./features/missions/MountWeeklyProgress.tsx";
const weeklyProgressContainer = document.getElementById("weekly-progress-root");
if (!weeklyProgressContainer) {
  throw new Error("Weekly progress container was not found.");
}
const weeklyProgress = mountWeeklyProgress(weeklyProgressContainer);
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let activeAccount = null;
  let accountReady = false;
  const base = [
    {
      skill: 'Anatomy',
      day: 'Monday',
      name: 'Gesture study',
      desc: 'Draw five 2-minute full-body gestures from references. Focus on movement, balance and the line of action.',
      easy: 'Draw three 1-minute gestures.',
      stretch: 'Add simple torso and pelvis construction.',
      xp: 20
    }, {
      skill: 'Faces',
      day: 'Tuesday',
      name: 'Expression explorer',
      desc: 'Sketch five different facial expressions. Change the eyebrows, eyes and mouth to show emotion.',
      easy: 'Draw three simple expression thumbnails.',
      stretch: 'Use different head angles.',
      xp: 20
    }, {
      skill: 'Color',
      day: 'Wednesday',
      name: 'Palette practice',
      desc: 'Choose a reference and make three small color palettes exploring different moods.',
      easy: 'Make one five-color palette.',
      stretch: 'Apply one palette to a tiny color thumbnail.',
      xp: 20
    }, {
      skill: 'Perspective',
      day: 'Thursday',
      name: 'A cozy little room',
      desc: 'Sketch a simple one-point-perspective room with a door, window and two objects.',
      easy: 'Draw the room and one object.',
      stretch: 'Try a second viewpoint.',
      xp: 20
    }, {
      skill: 'Design',
      day: 'Friday',
      name: 'Clothing silhouettes',
      desc: 'Sketch three clothing variations over a simple bust or mannequin. Explore shape and folds.',
      easy: 'Sketch two outfit silhouettes.',
      stretch: 'Add fabric folds and a small accessory.',
      xp: 20
    }
  ];
  const alternatives = {
    Anatomy: [['Pose silhouettes', 'Create five simple full-body silhouettes emphasizing weight and movement.'], ['Mannequin construction', 'Construct three figures using boxes, cylinders and spheres.']],
    Faces: [['Head angle study', 'Sketch three head angles with simple construction lines.'], ['Eyebrow acting', 'Draw six expressions using only eyes and eyebrows.']],
    Color: [['Warm and cool', 'Paint two tiny thumbnails, one warm and one cool.'], ['Value first', 'Create a three-value study from a reference.']],
    Perspective: [['Box garden', 'Draw six boxes at different heights using one-point perspective.'], ['Tiny street', 'Sketch a short street with a clear vanishing point.']],
    Design: [['Fabric folds', 'Study three fabric folds from reference.'], ['Accessory ideas', 'Design five small accessories for a character.']]
  };
  const quests = [
    {
      title: 'Expression Alchemist',
      skill: 'Faces',
      desc: 'Draw one character showing six distinct emotions, including three different head angles and two expressive shoulder or hand poses.'
    }, {
      title: 'The Pose Pathfinder',
      skill: 'Anatomy',
      desc: 'Draw eight gestures, then choose two to develop into simple full-body mannequins.'
    }, {
      title: 'The Palette Keeper',
      skill: 'Color',
      desc: 'Create four distinct color moods for the same small scene or character thumbnail.'
    }, {
      title: 'The Little Architect',
      skill: 'Perspective',
      desc: 'Draw a cozy room in one-point perspective, then redesign the furniture arrangement in a second sketch.'
    }, {
      title: 'Wardrobe Wanderer',
      skill: 'Design',
      desc: 'Create five outfit thumbnails for the same character, each with a noticeably different silhouette.'
    }
  ];
  const atelier = [
    {
      id: 'badge1',
      level: 5,
      title: 'A Little Emblem',
      desc: 'Draw a tiny still life featuring three objects you like. Upload it as proof to unlock your first editable Atelier Badge.',
      reward: 'Atelier Badge · First Bloom',
      icon: '🍄'
    }, {
      id: 'banner',
      level: 10,
      title: 'Your Creative Corner',
      desc: 'Draw a scene that feels like your ideal art space. Unlock the ability to personalize your profile banner.',
      reward: 'Profile banner slot',
      icon: '🏡'
    }, {
      id: 'badge2',
      level: 18,
      title: 'Shape Hunter',
      desc: 'Draw a sheet of twelve different silhouettes, focusing on clear and interesting shapes.',
      reward: 'Atelier Badge · Shape Hunter',
      icon: '🌿'
    }, {
      id: 'icon',
      level: 30,
      title: 'A Pocket-Sized World',
      desc: 'Draw four thumbnail ideas for a tiny icon that represents your artistic journey.',
      reward: 'Personal app icon slot',
      icon: '🐱'
    }, {
      id: 'badge3',
      level: 45,
      title: 'Color Story',
      desc: 'Create a small illustration using a limited five-color palette.',
      reward: 'Atelier Badge · Color Story',
      icon: '🎨'
    }
  ];
  const titleStages = [[1, 'The Curious Sketcher'], [10, 'The Wandering Artist'], [20, 'The Shape Seeker'], [30, 'The Color Weaver'], [40, 'The Art Magician'], [50, 'The Master of Many Strokes'], [60, 'The Evergreen Artist']];
  const cap = 3900;
  const perLevel = cap / 60;
  const fresh = () => ({
    theme: 'light',
    totalXp: 0,
    prestige: 0,
    skillXp: {},
    weekKey: '',
    missions: [],
    quest: null,
    questDone: false,
    questProof: null,
    atelierDone: {},
    custom: {},
    gallery: [],
    achievements: [],
    accountTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    completionEvents: [],
    xpLedger: []
  });
  let s;
  try {
    s = readScopedState(localStorage, null, fresh);
  }
  catch {
    s = fresh();
  }
  ;
  let current = 'home', expanded = -1, editing = null, previewUrl = null, previewData = null, zoom = 1, posX = 50, posY = 50;
  let designSaveBusy = false;
  const save = () => {
    try {
      writeScopedState(localStorage, activeAccount, s);
      window.dispatchEvent(new CustomEvent('pah:state-changed', {
        detail: {
          accountId: activeAccount
        }
      }));
    }
    catch {
      toast('Browser storage is full. Export a backup or use smaller images.');
    }
  };
  const toast = msg => { const e = $('toast'); e.textContent = msg; e.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => e.style.display = 'none', 2800); };
  const weekStart = () => mondayKey(Date.now(), s.accountTimeZone || 'UTC');
  const hash = str => {
    let h = 2166136261;
    for (let c of str)
      h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  function syncWeek() {
    let key = weekStart();
    if (s.weekKey !== key) {
      s.weekKey = key;
      let n = hash(key);
      s.missions = base.map((m, i) => ({
        ...m,
        done: false,
        rerolled: false,
        variant: (n + i) % 3
      }));
      s.quest = (n >>> 3) % quests.length;
      s.questDone = false;
      s.questProof = null;
      save();
    }
  }
  function level() { return Math.min(60, 1 + Math.floor(Math.min(cap - 0.0001, s.totalXp) / perLevel)); }
  function artistTitle() { let l = level(); return [...titleStages].reverse().find(t => l >= t[0])[1]; }
  function escapeHTML(x) {
    return String(x).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }
  function addXP(skill, xp) { s.totalXp = Math.min(cap, s.totalXp + xp); s.skillXp[skill] = (s.skillXp[skill] || 0) + xp; }
  function award(kind, slot, skill, xp) {
    const id = eventId(kind, s.weekKey, slot);
    const r = recordCompletion(s.xpLedger || [], {
      id,
      kind,
      skill,
      xp,
      cycle: s.prestige,
      completedAt: new Date().toISOString()
    });
    if (!r.added)
      return false;
    s.xpLedger = r.events;
    addXP(skill, xp);
    return true;
  }
  function show(page) {
    current = page;
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
    document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    render();
    scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
  function render() {
    if ($('xpSyncStatus'))
      $('xpSyncStatus').textContent = `${pendingEvents(s.xpLedger || []).length} XP events pending · cloud not connected`;
    document.body.classList.toggle('dark', s.theme === 'dark');
    $('theme').textContent = s.theme === 'dark' ? '☀ Theme' : '☾ Theme';
    const l = level(), done = s.missions.filter(m => m.done).length, pct = Math.round(done / 5 * 100), progress = l === 60 ? 100 : (s.totalXp % perLevel) / perLevel * 100;
    $('artistTitle').textContent = artistTitle();
    $('levelLabel').textContent = `Level ${l} · Prestige ${s.prestige}`;
    $('levelDetail').textContent = l === 60 ? 'Your next adventure awaits.' : `Your next level is just a little practice away.`;
    $('levelProgress').style.width = progress + '%';
    $('levelXp').textContent = `${Math.round(s.totalXp)} / ${cap} XP · Main journey`;
    $('weekPercent').textContent = $('weekPercent2').textContent = pct + '%';
    $('weekProgress').style.width = $('weekProgress2').style.width = pct + '%';
    $('weekCount').textContent = `${done} of 5 missions completed`;
    $('weekHeading').textContent = `Week of ${s.weekKey}`;
    let q = quests[s.quest];
    $('questSummary').innerHTML = `<b>${escapeHTML(q.title)}</b><div class="muted small">${s.questDone ? 'Completed ✓' : 'One challenge this week'}</div>`;
    $('homeMission').innerHTML = missionMarkup(s.missions.find(m => !m.done) || s.missions[0], s.missions.findIndex(m => !m.done) < 0 ? 0 : s.missions.findIndex(m => !m.done), true);
    $('missions').innerHTML = s.missions.map((m, i) => missionMarkup(m, i, false)).join('');
    $('skillGrid').innerHTML = ['Anatomy', 'Faces', 'Color', 'Perspective', 'Design', 'Composition'].map((name, i) => { let x = s.skillXp[name] || 0; return `<div class="card skill"><div style="font-size:25px">${['🌿', '🐱', '🎨', '🏡', '🧵', '✏️'][i]}</div><b>${name}</b><div class="muted small">${x} skill XP</div><div class="progress"><span style="width:${x % 100}%"></span></div></div>`; }).join('');
    $('prestigeStatus').textContent = `Prestige ${s.prestige} / 5 · ${'★'.repeat(s.prestige)}${'☆'.repeat(5 - s.prestige)}`;
    $('prestigeBtn').hidden = l < 60 || s.prestige >= 5;
    $('questTitle').textContent = q.title;
    $('questDesc').textContent = q.desc;
    $('questStatus').textContent = s.questDone ? 'Completed! Your effort has been recorded.' : 'Complete this more involved exercise whenever you are ready this week.';
    $('completeQuest').disabled = s.questDone;
    $('achievements').innerHTML = (s.achievements.length ? s.achievements : [
      {
        name: 'First Quest',
        icon: '✨',
        locked: true
      }
    ]).map(a => `<div class="badge-card"><button class="badge-open" data-achievement="${s.achievements.indexOf(a)}" ${a.locked ? 'disabled' : ''}><span class="badge ${a.locked ? 'locked' : ''}">${a.icon || '⭐'}</span><b class="small">${escapeHTML(a.name)}</b><span class="muted tiny">${a.locked ? 'Not yet earned' : 'View badge history ↗'}</span></button></div>`).join('');
    $('atelierShelf').querySelectorAll('.shelf-slot').forEach((el, i) => {
      const a = atelier.find(x => x.id === ['banner', 'badge1', null, null, null, 'icon'][i]);
      if (a && s.atelierDone[a.id]) {
        el.classList.remove('locked');
        el.classList.add('available');
        el.querySelector('.tiny').textContent = 'Unlocked · artwork slot ready';
      }
    });
    $('atelierChallenges').innerHTML = atelier.map(a => { let unlocked = l >= a.level || s.prestige > 0, finished = s.atelierDone[a.id]; return `<div class="card"><div class="row"><div><div class="section-label">Level ${a.level} · ${unlocked ? 'Available' : 'Locked 🔒'}</div><h3>${a.icon} ${escapeHTML(a.title)}</h3></div><span class="pill">${finished ? 'Completed ✓' : unlocked ? 'Ready' : 'Locked'}</span></div><p class="small muted">${escapeHTML(a.desc)}</p><div class="small"><b>Reward:</b> ${escapeHTML(a.reward)}</div>${unlocked && !finished ? `<div class="actions"><input class="field" type="file" accept="image/png,image/jpeg" id="proof-${a.id}" aria-label="Upload proof for ${escapeHTML(a.title)}"><button class="btn primary" data-atelier="${a.id}">Submit challenge proof</button></div>` : finished ? `<div class="small muted">Proof saved with this reward. ${finished.proof ? '<button class="btn" data-proof="' + a.id + '">View proof</button>' : ''}</div>` : ''}</div>`; }).join('');
    renderEditor();
    renderGallery();
    $('profileLevel').textContent = `Level ${l} · Prestige ${s.prestige}`;
    $('profileTitle').textContent = artistTitle();
    $('profileStars').textContent = `${'★'.repeat(s.prestige)}${'☆'.repeat(5 - s.prestige)} · ${Math.round(s.totalXp)} XP this cycle`;
    $('profileBadges').innerHTML = atelier.filter(a => s.atelierDone[a.id] && a.id.startsWith('badge')).map(a => `<div class="badge-card"><button class="badge-open" data-atelier-badge="${a.id}"><span class="badge">${s.custom[a.id] && !s.custom[a.id].inactive ? `<img data-design-ref="${escapeHTML(s.custom[a.id].data)}" style="object-position:${s.custom[a.id].x}% ${s.custom[a.id].y}%;transform:scale(${s.custom[a.id].zoom})">` : a.icon}</span><b class="small">${escapeHTML(a.reward)}</b><span class="muted tiny">View badge history ↗</span></button></div>`).join('') + (s.achievements.map(a => `<div class="badge-card"><button class="badge-open" data-achievement="${s.achievements.indexOf(a)}"><span class="badge">${a.icon || '⭐'}</span><b class="small">${escapeHTML(a.name)}</b><span class="muted tiny">View badge history ↗</span></button></div>`).join('') || '<p class="muted small">Your collection begins with your first achievement.</p>');
  }
  function showBadgeDetails(kind, id) {
    let badge, earned, proof, title, challenge, icon, custom;
    if (kind === 'atelier') {
      badge = atelier.find(a => a.id === id && a.id.startsWith('badge'));
      if (!badge || !s.atelierDone[id])
        return;
      earned = s.atelierDone[id];
      proof = earned.proof;
      title = badge.reward;
      challenge = badge.title;
      icon = badge.icon;
      custom = s.custom[id];
    }
    else {
      badge = s.achievements[Number(id)];
      if (!badge || badge.locked)
        return;
      earned = badge;
      proof = badge.proof;
      title = badge.name;
      challenge = badge.name;
      icon = badge.icon || '⭐';
    }
    const d = $('badgeDetails');
    $('badgeDetailTitle').textContent = title;
    $('badgeDetailKind').textContent = kind === 'atelier' ? 'Atelier Badge · customizable artwork' : 'Achievement Badge · original artwork';
    $('badgeDetailDate').textContent = earned.date && !Number.isNaN(Date.parse(earned.date)) ? new Date(earned.date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'Date not recorded';
    $('badgeDetailChallenge').textContent = 'Earned by completing: ' + challenge;
    $('badgeDetailIcon').replaceChildren();
    if (custom?.data && !custom.inactive) {
      const im = document.createElement('img');
      im.src = custom.data;
      im.alt = 'Your custom badge design';
      im.style.objectPosition = `${custom.x || 50}% ${custom.y || 50}%`;
      im.style.transform = `scale(${custom.zoom || 1})`;
      $('badgeDetailIcon').append(im);
    }
    else {
      $('badgeDetailIcon').textContent = icon;
    }
    const proofBox = $('badgeDetailProof'), reveal = $('viewBadgeDrawing'), deleteBtn = $('deleteBadgeProof');
    deleteBtn.hidden = !proof;
    deleteBtn.dataset.kind = kind;
    deleteBtn.dataset.id = String(id);
    proofBox.replaceChildren();
    proofBox.hidden = true;
    reveal.hidden = false;
    reveal.setAttribute('aria-expanded', 'false');
    reveal.textContent = 'View drawing';
    if (proof) {
      reveal.disabled = false;
      reveal.dataset.proof = proof;
    }
    else {
      reveal.disabled = true;
      delete reveal.dataset.proof;
      reveal.textContent = 'No proof drawing recorded';
    }
    d.showModal();
  }
  $('deleteBadgeProof').onclick = async () => {
    const button = $('deleteBadgeProof');
    const kind = button.dataset.kind, id = button.dataset.id;
    let record;
    if (kind === 'atelier') {
      record = s.atelierDone[id];
    }
    else {
      record = s.achievements[Number(id)];
    }
    if (!record || !record.proof)
      return;
    if (!confirm('Permanently delete this proof drawing? Your badge and acquisition date will stay. This cannot be undone.'))
      return;
    const originalProof = record.proof, owner = activeAccount;
    if (originalProof.startsWith('vault:')) {
      try {
        await window.pahGalleryVault.remove(originalProof.slice(6));
      }
      catch (err) {
        toast('Could not delete encrypted proof: ' + err.message);
        return;
      }
      if (owner !== activeAccount || record.proof !== originalProof)
        return;
    }
    delete record.proof;
    if (kind === 'atelier') {
      document.dispatchEvent(new CustomEvent('pah:artwork-proof-deleted', {
        detail: {
          kind: 'atelier-proof',
          slot: id
        }
      }));
    }
    else {
      const badge = s.achievements[Number(id)];
      document.dispatchEvent(new CustomEvent('pah:artwork-proof-deleted', {
        detail: {
          kind: 'quest-proof',
          slot: badge.weekKey || s.weekKey
        }
      }));
    }
    if (kind === 'achievement' && s.questDone && s.achievements[Number(id)]?.weekKey === s.weekKey)
      s.questProof = null;
    save();
    showBadgeDetails(kind, id);
    toast('Proof drawing deleted. Your badge is safe.');
  };
  $('viewBadgeDrawing').onclick = async () => {
    const reveal = $('viewBadgeDrawing'), box = $('badgeDetailProof');
    if (!reveal.dataset.proof)
      return;
    if (box.hidden) {
      const expected = reveal.dataset.proof, account = activeAccount;
      let url;
      try {
        url = await proofURL(expected);
      }
      catch (err) {
        toast('Could not unlock proof: ' + err.message);
        return;
      }
      if (!url || account !== activeAccount || expected !== reveal.dataset.proof)
        return;
      const im = document.createElement('img');
      im.src = url;
      im.alt = 'Drawing submitted for this badge';
      box.replaceChildren(im);
      box.hidden = false;
      reveal.textContent = 'Hide drawing';
      reveal.setAttribute('aria-expanded', 'true');
    }
    else {
      box.hidden = true;
      box.replaceChildren();
      reveal.textContent = 'View drawing';
      reveal.setAttribute('aria-expanded', 'false');
    }
  };
  $('badgeDetails').addEventListener('close', () => { $('badgeDetailProof').replaceChildren(); $('badgeDetailProof').hidden = true; delete $('viewBadgeDrawing').dataset.proof; $('deleteBadgeProof').hidden = true; $('viewBadgeDrawing').setAttribute('aria-expanded', 'false'); });
  $('closeBadgeDetails').onclick = () => $('badgeDetails').close();
  $('badgeDetails').addEventListener('click', e => {
    if (e.target === $('badgeDetails'))
      $('badgeDetails').close();
  });
  function missionMarkup(m, i, short) { let name = m.rerolled ? alternatives[m.skill][m.variant % 2][0] : m.name, desc = m.rerolled ? alternatives[m.skill][m.variant % 2][1] : m.desc; return `<div class="mission"><div class="mission-head"><button class="check ${m.done ? 'done' : ''}" data-complete="${i}" aria-label="${m.done ? 'Undo' : 'Complete'} ${escapeHTML(name)}">${m.done ? '✓' : ''}</button><div class="info"><b>${escapeHTML(name)}</b><div class="muted tiny">${m.day} · ${m.skill} · +${m.xp} XP</div></div><button class="btn" data-expand="${i}" aria-expanded="${expanded === i}">${expanded === i ? 'Less' : 'Details'}</button></div>${expanded === i ? `<div class="mission-desc"><div>${escapeHTML(desc)}</div><div class="small" style="margin-top:8px"><b>Low-energy:</b> ${escapeHTML(m.easy)}</div><div class="small" style="margin-top:5px"><b>Optional stretch:</b> ${escapeHTML(m.stretch)}</div>${!short ? `<div class="actions"><button class="btn" data-reroll="${i}" ${m.rerolled || m.done ? 'disabled' : ''}>${m.rerolled ? 'Reroll used' : '↻ Reroll once'}</button></div>` : ''}</div>` : ''}</div>`; }
  function renderEditor() {
    let available = atelier.filter(a => s.atelierDone[a.id] && a.id.startsWith('badge'));
    $('badgeEditor').innerHTML = available.length ? `<label class="small">Choose an unlocked Atelier Badge</label><select class="field" id="badgeSelect"><option value="">Select a badge…</option>${available.map(a => `<option value="${a.id}" ${editing === a.id ? 'selected' : ''}>${escapeHTML(a.reward)}</option>`).join('')}</select><div id="editorBody"></div>` : '<p class="muted small">Complete a level-gated Atelier Badge challenge to unlock this workshop.</p>';
    if (available.length) {
      if (!editing || !available.some(a => a.id === editing))
        editing = available[0].id;
      $('badgeSelect').value = editing;
      let existing = s.custom[editing];
      $('editorBody').innerHTML = `<div class="preview" id="cropPreview">${previewData ? `<img id="cropImg" src="${previewData}">` : existing && !existing.inactive ? `<img id="cropImg" data-design-ref="${escapeHTML(existing.data)}">` : '🍄'}</div><label class="small">Upload replacement PNG or JPG</label><input class="field" id="customUpload" type="file" accept="image/png,image/jpeg"><label class="small">Zoom <input id="zoom" type="range" min="1" max="2.5" step="0.05" value="${zoom}"></label><label class="small">Move horizontally <input id="posX" type="range" min="0" max="100" value="${posX}"></label><label class="small">Move vertically <input id="posY" type="range" min="0" max="100" value="${posY}"></label><div class="actions"><button class="btn primary" id="confirmCustom" ${previewData ? '' : 'disabled'}>Confirm design</button><button class="btn" id="restoreCustom">Restore original</button>${existing?.inactive ? '<button class="btn" id="reequipCustom">Re-equip saved design</button>' : ''}<button class="btn" id="template">Download circular template</button></div><p class="muted tiny">Changes apply across the app when you confirm. Restore original keeps your latest custom upload ready to re-equip.</p>`;
      updateCrop();
      resolveDesignImages($('editorBody'));
    }
  }
  function updateCrop() {
    let img = $('cropImg');
    if (img) {
      img.style.objectPosition = `${posX}% ${posY}%`;
      img.style.transform = `scale(${zoom})`;
    }
  }
  function resolveDesignImages(root = document) {
    const owner = activeAccount;
    for (const img of root.querySelectorAll('img[data-design-ref]')) {
      const ref = img.dataset.designRef;
      if (!ref?.startsWith('vault:')) {
        if (ref?.startsWith('data:image/'))
          img.src = ref;
        continue;
      }
      window.pahGalleryVault?.url(ref.slice(6)).then(url => {
        if (url && owner === activeAccount && img.isConnected && img.dataset.designRef === ref)
          img.src = url;
      }).catch(() => {
        if (img.isConnected)
          img.alt = 'Unlock vault to view badge design';
      });
    }
  }
  async function migrateLegacyDesigns(owner) {
    if (!owner || owner !== activeAccount || !window.pahGalleryVault)
      return;
    for (const [id, design] of Object.entries(s.custom || {})) {
      if (owner !== activeAccount)
        return;
      if (!design?.data?.startsWith('data:image/'))
        continue;
      let file;
      try {
        const response = await fetch(design.data);
        const blob = await response.blob();
        file = new File([blob], `atelier-${id}.png`, {
          type: blob.type || 'image/png'
        });
      }
      catch {
        continue;
      }
      let entry;
      try {
        entry = await window.pahGalleryVault.save(file);
        const verified = await window.pahGalleryVault.url(entry.id);
        if (!verified)
          throw Error('Encrypted design verification failed');
        if (owner !== activeAccount)
          return;
        if (s.custom[id] !== design)
          continue;
        s.custom[id] = {
          ...design,
          data: 'vault:' + entry.id
        };
        save();
      }
      catch (err) {
        console.warn('Atelier design migration deferred', id, err);
      }
    }
    resolveDesignImages();
  }
  function renderGallery() {
    $('galleryItems').innerHTML = s.gallery.map((g, i) => `<div class="gallery-item">${g.type === 'image' ? `<img src="${g.data}" alt="Saved inspiration">` : g.type === 'encrypted-image' ? `<img data-gallery-id="${escapeHTML(g.id)}" alt="Encrypted inspiration (unlocking)">` : '<div style="font-size:34px">📎</div>'}<div class="small">${g.type === 'image' ? 'Saved artwork' : 'Saved reference'}</div>${g.url ? `<a href="${escapeHTML(g.url)}" target="_blank" rel="noopener noreferrer" class="tiny">Open original ↗</a>` : ''}<div><button class="btn" data-delete-gallery="${i}">Remove</button></div></div>`).join('') || '<p class="muted small">Your inspiration collection is waiting for its first reference.</p>';
    for (const img of $('galleryItems').querySelectorAll('[data-gallery-id]')) {
      const id = img.dataset.galleryId;
      const account = activeAccount;
      window.pahGalleryVault?.url(id).then(url => {
        if (url && account === activeAccount && img.isConnected)
          img.src = url;
      }).catch(() => {
        if (img.isConnected)
          img.alt = 'Unlock vault to view artwork';
      });
    }
  }
  async function savePrivateProof(file) {
    const owner = activeAccount;
    if (!owner || !window.pahGalleryVault)
      throw Error('Sign in and unlock your vault before saving proof');
    const entry = await window.pahGalleryVault.save(file);
    if (owner !== activeAccount) {
      await window.pahGalleryVault.removeForAccount?.(owner, entry.id);
      throw Error('Account changed while saving proof');
    }
    return 'vault:' + entry.id;
  }
  async function proofURL(proof) {
    if (!proof)
      return null;
    if (proof.startsWith('vault:'))
      return window.pahGalleryVault?.url(proof.slice(6)) || null;
    return proof; // legacy plaintext proofs remain readable until separately migrated
  }
  function imageData(file) {
    return new Promise((resolve, reject) => {
      if (!file || !['image/png', 'image/jpeg'].includes(file.type))
        return reject(Error('Please choose a PNG or JPG.'));
      if (file.size > 2 * 1024 * 1024)
        return reject(Error('Please use an image under 2 MB for this browser prototype.'));
      let r = new FileReader;
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(Error('Could not read image'));
      r.readAsDataURL(file);
    });
  }
  document.addEventListener('click', async (e) => {
    let b = e.target.closest('button');
    if (!b)
      return;
    if (b.dataset.atelierBadge) {
      showBadgeDetails('atelier', b.dataset.atelierBadge);
      return;
    }
    if (b.dataset.achievement !== undefined) {
      showBadgeDetails('achievement', b.dataset.achievement);
      return;
    }
    if (b.dataset.page) {
      show(b.dataset.page);
      return;
    }
    if (b.dataset.expand !== undefined) {
      let i = +b.dataset.expand;
      expanded = expanded === i ? -1 : i;
      render();
      return;
    }
    if (b.dataset.complete !== undefined) {
      let m = s.missions[+b.dataset.complete];
      if (m.done) {
        toast('Already completed! Your earned XP is permanent.');
      }
      else if (award('mission', String(+b.dataset.complete), m.skill, m.xp)) {
        m.done = true;
        toast(`+${m.xp} XP · ${m.skill} 🌱 · waiting to sync`);
      }
      else {
        m.done = true;
        toast('Already recorded — no duplicate XP');
      }
      save();
      render();
      return;
    }
    if (b.dataset.reroll !== undefined) {
      let m = s.missions[+b.dataset.reroll];
      if (!m.rerolled && !m.done) {
        m.rerolled = true;
        toast('New exercise, same skill 🍄');
        save();
        render();
      }
      return;
    }
    if (b.dataset.atelier) {
      let a = atelier.find(x => x.id === b.dataset.atelier), f = $('proof-' + a.id)?.files[0];
      if (!f)
        return toast('Please upload your challenge drawing first.');
      try {
        let data = await savePrivateProof(f);
        s.atelierDone[a.id] = {
          proof: data,
          date: new Date().toISOString()
        };
        save();
        document.dispatchEvent(new CustomEvent('pah:artwork-confirmed', {
          detail: {
            file: f,
            kind: 'atelier-proof',
            slot: a.id
          }
        }));
        toast('Atelier reward unlocked! 🎨');
        render();
      }
      catch (err) {
        toast(err.message);
      }
      return;
    }
    if (b.dataset.proof) {
      let proof = s.atelierDone[b.dataset.proof]?.proof;
      if (proof) {
        try {
          const url = await proofURL(proof);
          if (url)
            window.open(url, '_blank', 'noopener');
        }
        catch (err) {
          toast(err.message);
        }
      }
      return;
    }
    if (b.dataset.deleteGallery !== undefined) {
      const i = +b.dataset.deleteGallery, item = s.gallery[i];
      if (!item)
        return;
      if (item.type === 'encrypted-image') {
        try {
          await window.pahGalleryVault.remove(item.id);
        }
        catch (err) {
          toast('Could not remove encrypted artwork: ' + err.message);
          return;
        }
      }
      s.gallery.splice(i, 1);
      save();
      renderGallery();
      return;
    }
  });
  document.querySelector('.nav').addEventListener('click', e => {
    let b = e.target.closest('[data-page]');
    if (b)
      show(b.dataset.page);
  });
  $('theme').onclick = () => { s.theme = s.theme === 'light' ? 'dark' : 'light'; save(); render(); };
  $('completeQuest').onclick = async () => {
    syncWeek();
    render();
    if (s.questDone)
      return;
    let f = $('questProof').files[0];
    if (!f)
      return toast('Choose one drawing to remember this quest.');
    try {
      s.questProof = await savePrivateProof(f);
    }
    catch (err) {
      return toast(err.message);
    }
    if (weekStart() !== s.weekKey)
      return toast('This weekly quest has expired. Your drawing is still on your device.');
    if (!award('quest', 'weekly', quests[s.quest].skill, 50))
      return toast('Quest already recorded.');
    s.questDone = true;
    s.achievements.push({
      name: quests[s.quest].title,
      icon: '✨',
      date: new Date().toISOString(),
      proof: s.questProof,
      weekKey: s.weekKey
    });
    save();
    document.dispatchEvent(new CustomEvent('pah:artwork-confirmed', {
      detail: {
        file: f,
        kind: 'quest-proof',
        slot: s.weekKey
      }
    }));
    toast('Quest completed! +50 XP ✨');
    render();
  };
  $('prestigeBtn').onclick = () => {
    if (level() !== 60 || s.prestige >= 5)
      return;
    if (!confirm('Begin Prestige ' + (s.prestige + 1) + '? Your displayed level restarts, but everything else stays.'))
      return;
    s.prestige++;
    s.totalXp = 0;
    save();
    toast('A new artistic chapter begins ★');
    render();
  };
  $('addUrl').onclick = () => {
    let u = $('refUrl').value.trim();
    try {
      let x = new URL(u);
      if (!['https:', 'http:'].includes(x.protocol))
        throw Error();
      s.gallery.unshift({
        type: 'link',
        url: u
      });
      $('refUrl').value = '';
      save();
      renderGallery();
      toast('Reference saved');
    }
    catch {
      toast('Please enter a valid web link');
    }
  };
  $('galleryUpload').onchange = async (e) => {
    try {
      if (!window.pahGalleryVault)
        throw Error('Private gallery storage is not ready');
      const uploadOwner = activeAccount;
      if (!uploadOwner)
        throw Error('Sign in to save private artwork');
      const entry = await window.pahGalleryVault.save(e.target.files[0]);
      if (activeAccount !== uploadOwner) {
        await window.pahGalleryVault.removeForAccount?.(uploadOwner, entry.id);
        throw Error('Account changed during gallery upload');
      }
      s.gallery.unshift(entry);
      save();
      document.dispatchEvent(new CustomEvent('pah:artwork-confirmed', {
        detail: {
          file: e.target.files[0],
          kind: 'inspiration'
        }
      }));
      renderGallery();
      toast('Artwork encrypted and saved');
    }
    catch (err) {
      toast(err.message);
    }
    finally {
      e.target.value = '';
    }
  };
  document.addEventListener('change', async (e) => {
    if (e.target.id === 'badgeSelect') {
      editing = e.target.value;
      previewData = null;
      zoom = 1;
      posX = posY = 50;
      renderEditor();
    }
    if (e.target.id === 'customUpload') {
      try {
        previewData = await imageData(e.target.files[0]);
        $('cropPreview').innerHTML = `<img id="cropImg" src="${previewData}">`;
        $('confirmCustom').disabled = false;
        updateCrop();
      }
      catch (err) {
        toast(err.message);
      }
    }
  });
  document.addEventListener('input', e => {
    if (['zoom', 'posX', 'posY'].includes(e.target.id)) {
      zoom = +$('zoom').value;
      posX = +$('posX').value;
      posY = +$('posY').value;
      updateCrop();
    }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b)
      return;
    let id = b.id;
    if (id === 'confirmCustom' && previewData && !designSaveBusy) {
      const owner = activeAccount, slot = editing, old = s.custom[slot], file = $('customUpload')?.files?.[0];
      if (!owner || !file || !window.pahGalleryVault)
        return toast('Unlock your private vault before confirming a design');
      designSaveBusy = true;
      b.disabled = true;
      let entry;
      try {
        entry = await window.pahGalleryVault.save(file);
        const checked = await window.pahGalleryVault.url(entry.id);
        if (!checked)
          throw Error('Saved design could not be verified');
        if (owner !== activeAccount || slot !== editing)
          throw Error('Account or badge changed during upload');
        s.custom[slot] = {
          data: 'vault:' + entry.id,
          zoom,
          x: posX,
          y: posY,
          inactive: false
        };
        save();
        previewData = null;
        document.dispatchEvent(new CustomEvent('pah:artwork-confirmed', {
          detail: {
            file,
            kind: 'atelier-design',
            slot
          }
        }));
        toast('Your encrypted design is equipped! 🍄');
        render();
        if (old?.data?.startsWith('vault:'))
          window.pahGalleryVault.removeForAccount(owner, old.data.slice(6)).catch(err => console.warn('Old design cleanup pending', err));
      }
      catch (err) {
        if (entry)
          window.pahGalleryVault.removeForAccount?.(owner, entry.id).catch(() => { });
        toast('Design unchanged: ' + err.message);
      }
      finally {
        designSaveBusy = false;
        if (b.isConnected)
          b.disabled = false;
      }
    }
    if (id === 'restoreCustom') {
      if (s.custom[editing])
        s.custom[editing].inactive = true;
      previewData = null;
      zoom = 1;
      posX = posY = 50;
      save();
      toast('Original design restored');
      render();
    }
    if (id === 'reequipCustom' && s.custom[editing]) {
      s.custom[editing].inactive = false;
      save();
      render();
      toast('Saved design equipped!');
    }
    if (id === 'template') {
      let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#f5f0e5"/><circle cx="300" cy="300" r="285" fill="none" stroke="#648568" stroke-width="8"/><circle cx="300" cy="300" r="235" fill="none" stroke="#b9a788" stroke-width="4" stroke-dasharray="12 10"/><text x="300" y="300" font-size="24" text-anchor="middle" fill="#648568">Keep important details</text><text x="300" y="335" font-size="24" text-anchor="middle" fill="#648568">inside the dashed circle</text></svg>';
      let a = document.createElement('a');
      a.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      a.download = 'atelier-badge-template.svg';
      a.click();
    }
  });
  $('exportData').onclick = () => {
    let a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 2)], {
      type: 'application/json'
    }));
    a.download = 'pocket-art-helper-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('resetDemo').onclick = () => {
    if (!confirm('Erase this browser demo progress? This cannot be undone.'))
      return;
    s = fresh();
    syncWeek();
    save();
    render();
    toast('Demo reset');
  };
  new MutationObserver(() => resolveDesignImages()).observe(document.body, {
    subtree: true,
    childList: true
  });
  window.addEventListener('pah:account-changed', ev => {
    const next = ev.detail?.accountId ?? null;
    if (next === activeAccount && accountReady)
      return;
    try {
      const replacement = readScopedState(localStorage, next, fresh);
      activeAccount = next;
      accountReady = true;
      s = replacement;
      expanded = -1;
      editing = null;
      previewData = null;
      const dialog = $('badgeDetails');
      if (dialog?.open)
        dialog.close();
      syncWeek();
      render();
    }
    catch (err) {
      toast(err.message);
      document.dispatchEvent(new CustomEvent('pah:account-switch-failed', {
        detail: {
          message: err.message
        }
      }));
    }
  });
  window.pahGalleryState = {
    read: () => s,
    commit: async (owner, next) => {
      if (owner !== activeAccount)
        throw Error('Account changed during cloud gallery commit');
      writeScopedState(localStorage, owner, next);
      s = next;
      renderGallery();
    }
  };
  const migrateLegacyGallery = createLegacyGalleryMigration({
    gallery: {
      save: file => window.pahGalleryVault.save(file),
      url: id => window.pahGalleryVault.url(id)
    },
    persist: async (owner, next) => {
      if (owner !== activeAccount)
        throw Error('Account switched before gallery migration commit');
      writeScopedState(localStorage, owner, next);
      s = next;
      renderGallery();
    }
  });
  const migrateLegacyProofs = createLegacyProofMigration({
    gallery: {
      save: file => window.pahGalleryVault.save(file),
      url: id => window.pahGalleryVault.url(id)
    },
    persist: async (owner, next) => {
      if (owner !== activeAccount)
        throw Error('Account switched before proof migration commit');
      writeScopedState(localStorage, owner, next);
      s = next;
      render();
    }
  });
  let galleryMigrationOwner = null;
  window.addEventListener('pah:gallery-vault-ready', () => {
    renderGallery();
    const owner = activeAccount;
    if (!owner || galleryMigrationOwner === owner)
      return;
    galleryMigrationOwner = owner;
    migrateLegacyGallery({
      owner,
      getState: () => s,
      isCurrent: a => a === activeAccount
    }).then(result => {
      if (result?.failures?.length)
        console.warn('Legacy artwork migration incomplete; originals retained', result.failures);
      if (result?.migrated)
        renderGallery();
      migrateLegacyDesigns(owner).catch(err => console.warn('Design migration deferred', err));
      migrateLegacyProofs({
        owner,
        getState: () => s,
        isCurrent: a => a === activeAccount
      }).then(r => {
        if (r?.failures?.length)
          console.warn('Legacy proof migration incomplete; originals retained', r.failures);
      }).catch(err => console.warn('Legacy proof migration deferred', err));
    }).catch(err => console.warn('Legacy artwork migration deferred', err)).finally(() => { galleryMigrationOwner = null; });
  });
  window.addEventListener('pah:completion-reconciled', ev => {
    const incoming = ev.detail?.events;
    if (ev.detail?.accountId !== activeAccount || !Array.isArray(incoming))
      return;
    const before = totals(s.xpLedger || [], s.prestige);
    const after = totals(incoming, s.prestige);
    s.xpLedger = incoming;
    s.totalXp = Math.max(0, Math.min(cap, s.totalXp + after.cycleXp - before.cycleXp));
    for (const skill of new Set([...Object.keys(before.skillXp), ...Object.keys(after.skillXp)]))
      s.skillXp[skill] = Math.max(0, (s.skillXp[skill] || 0) + (after.skillXp[skill] || 0) - (before.skillXp[skill] || 0));
    try {
      writeScopedState(localStorage, activeAccount, s);
    }
    catch { }
    render();
  });
  syncWeek();
  render();
})();
