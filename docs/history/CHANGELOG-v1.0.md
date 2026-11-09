# Pocket Art Helper v1.0 — badge drawing reveal

- Badge details show acquisition date and challenge immediately, but proof artwork remains hidden until **View drawing** is pressed.
- The button changes to **Hide drawing**, and its accessibility state tracks visibility.
- Switching badges and closing the dialog clear the previous image node, preventing stale proof drawings from appearing in another badge.
- Badges with no saved proof show a disabled explanation instead of a broken image.
- Added automated source contract tests for the reveal interaction.

## Still incomplete

Browser-local images and IndexedDB upload queue are not yet a unified artwork library. Cloud downloads and cross-device image display remain unimplemented. Backend integration and live multi-device testing remain necessary.
