# Artwork optimization policy (v0.8)

Before an artwork file enters the IndexedDB offline queue, the browser decodes it, respects its orientation, downsizes the longest edge to 2048px, and re-encodes opaque images as JPEG (quality 0.84). Images with transparency are stored as PNG to preserve badge edges and decorations. Images already below 2048px are retained in their original form when conversion would increase their size. Source files are never changed. The upload queue stores the optimized blob and original/optimized byte counts.

Accepted inputs: JPG, PNG and WebP up to 30MB. Images with over 60 million decoded pixels are rejected to limit memory exhaustion. Animated images are **not** preserved as animations: only a decoded still frame is used. Browser decoding can fail for corrupt files, unsupported codecs or low-memory devices; errors must be shown without losing previously saved art.

The legacy single-file UI still has a separate 2MB image limit for localStorage-based gallery and badge previews. This is an integration gap: large optimized uploads can queue for cloud but may fail in the local demo UI. The next step is to move displayed artwork and proof records to IndexedDB and associate uploads with confirmed challenge submissions, not mere file selections.

Security: optimization is not malware scanning. MIME and file extension checks alone are insufficient for server-side trust. Storage buckets must remain private and authenticated, and uploads should enforce MIME and size constraints server-side.

Manual browser tests still required: EXIF rotated JPEG, alpha PNG, enormous dimensions, corrupt file, Safari canvas limits, offline reload during optimization, upload retries, and sign-out/account switching. Automated tests cover policy and resizing calculations, not browser canvas behavior.
