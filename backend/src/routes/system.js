const { createSystemRoutes } = require('publicwerx-core');

module.exports = createSystemRoutes({
  systemKey: process.env.SYSTEM_API_KEY,
});
