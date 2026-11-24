function validateVersions(versions) {
  if (
    versions === null ||
    typeof versions !== 'object' ||
    Array.isArray(versions) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(versions))
  ) {
    throw new TypeError('Expected a version vector');
  }

  for (const [deviceId, counter] of Object.entries(versions)) {
    if (
      !deviceId ||
      !Number.isSafeInteger(counter) ||
      counter < 1
    ) {
      throw new TypeError('Invalid device identifier or version counter');
    }
  }
}

export function compareVersions(left, right) {
  validateVersions(left);
  validateVersions(right);

  const deviceIds = new Set([
    ...Object.keys(left),
    ...Object.keys(right),
  ]);

  let hasHigher = false;
  let hasLower = false;

  for (const deviceId of deviceIds) {
    const leftCounter = Object.hasOwn(left, deviceId)
      ? left[deviceId]
      : 0;
    const rightCounter = Object.hasOwn(right, deviceId)
      ? right[deviceId]
      : 0;

    if (leftCounter > rightCounter) hasHigher = true;
    if (leftCounter < rightCounter) hasLower = true;
  }

  if (hasHigher && hasLower) return 'concurrent';
  if (hasHigher) return 'after';
  if (hasLower) return 'before';
  return 'equal';
}