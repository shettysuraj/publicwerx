const { createSystemRoutes } = require('publicwerx-core');

module.exports = createSystemRoutes({
  systemKey: process.env.SYSTEM_API_KEY,
  // Execute privilege is separate from read. Unset falls back to systemKey,
  // so this is inert until the box is given a key.
  writeKey: process.env.SYSTEM_WRITE_KEY,
});
