# v0.9 — Badge history and artwork submission consistency

- No progress journal. Replaced the unused “Journal sticker” preview with “Sketchbook corner.”
- Achievement and earned Atelier badges open an accessible dialog showing acquisition date, related challenge and submitted proof drawing.
- Weekly quests now require one proof image, matching the intended challenge rules. Regular weekly missions remain honor-based.
- Restoring an Atelier badge's original appearance retains its latest custom design for re-equipping.
- Cloud queue now listens for confirmed image saves/submissions, rather than queueing proof on file selection.

## Remaining limitations
- Live cloud auth, artwork downloads and multi-device synchronization need a configured Supabase project and end-to-end testing.
- Local demo still embeds small images in browser storage (2 MB limit); unified IndexedDB artwork persistence and cloud hydration are next.
- Current local app is still a prototype, not a deployable production service.
