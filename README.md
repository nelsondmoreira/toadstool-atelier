# Toadstool Atelier 🍄

A cozy offline-first art-practice adventure. This is a **prototype under architectural migration**, not a production-ready service.

## Quick start
```sh
npm install
npm run dev
npm test
npm run build
```

Read [the documentation index](docs/README.md) for setup, testing, architecture, decisions and Supabase operations.

## Current technology vs approved migration direction
Current: vanilla JS, Vite, IndexedDB, Supabase source and Node tests. Target: React + TypeScript + Vite, Supabase, and a staged move to Vitest/Playwright. **The target frontend migration has not been implemented in this archive.** No additional framework is installed until a verified, working migration step.

Never commit `.env` or credentials. Keep the repository private while backend policies and security remain unverified.

## Contributing and conventions

Read [Development Rules & Guidelines](CONTRIBUTING.md) before making changes. Architecture changes require owner approval and a documented ADR.
