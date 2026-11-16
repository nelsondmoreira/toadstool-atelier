# ADR-0002: React island boundaries and visual ownership

Status: **Approved by the product owner in this conversation; integration is still in progress.**

## Context

The gradual migration uses independent React islands, starting with the weekly progress summary. The initial proposal placed the `card` class on the mount point to preserve the `.layout > .card` selector. This split the card's visual structure between the host HTML and the React component.

## Decision

- The host HTML provides an identified mount point without presentation classes owned by the component. The surrounding page layout remains the host's responsibility.
- The React component defines the island's complete visual structure, including the outer card and its classes.
- Static styles remain in the existing CSS. Do not introduce another styling solution in this step. Inline styles are allowed for calculated dynamic values, such as the progress bar's percentage width.
- The adapter exposes an explicit interface for mounting, updating and unmounting the island. It contains neither presentation nor persistence logic.
- Legacy JavaScript supplies data through the adapter and stops writing to the island's internal DOM.
- An island can contain multiple components. Do not create a root or an adapter for each internal component.

## Intended example

Host HTML:

```html
<div id="weekly-progress-root"></div>
```

Component:

```tsx
<div className="card">
  {/* Complete card content. */}
</div>
```

The additional container requires adapting the layout CSS: the card is no longer a direct child of `.layout`. Preserve its behavior with an explicit selector for the card inside the mount point; do not duplicate the card's presentation on the host.

## Rejected alternative

Placing `class="card"` in the HTML and using a Fragment in the component avoids a CSS change but distributes visual ownership across two files. Do not follow that earlier proposal.

## Manual integration steps

1. In the HTML, remove `class="card"` from `weekly-progress-root`. Keep the mount point in the original card's position.
2. In `WeeklyProgress.tsx`, keep the outer `<div className="card">`; do not replace it with a Fragment.
3. Replace the static `marginTop: 7` style with a dedicated class defined in `frontend/styles/main.css`. Keep the dynamic bar width in the component.
4. In the existing CSS, preserve the card's zero margin within `.layout` by adding a specific rule for `.layout > #weekly-progress-root > .card`.
5. Create the root once in `app.mjs` through the adapter. In `render()`, supply `completed` and `total` and remove writes to the old `weekPercent`, `weekProgress` and `weekCount` elements. Preserve updates to `weekPercent2` and `weekProgress2`, which belong to the still-legacy missions page.
6. Run `npm.cmd run typecheck`, `npm.cmd test` and `npm.cmd run build`. In the browser, verify progress, themes, screen sizes, navigation and reloads using demo data that can be changed. Do not delete data to test.
7. Update current-state documentation and development commands. Include type checking in the aggregate validation command and CI, preserving existing tests and the build. Review outdated statements claiming React is not installed yet.

## Consequences and boundaries

The component owns its complete structure, and styles remain centralized in the existing CSS. The host layout needs to account for the island's container. This decision does not authorize changes to persistence, encryption, mission rules, authentication or offline behavior.

This record describes the approved direction and integration steps; it does not establish that integration or browser verification is complete.
