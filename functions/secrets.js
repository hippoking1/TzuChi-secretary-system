const { defineSecret } = require('firebase-functions/params');

const LINE_CHANNEL_SECRET = defineSecret('LINE_CHANNEL_SECRET');
const LINE_CHANNEL_ACCESS_TOKEN = defineSecret('LINE_CHANNEL_ACCESS_TOKEN');

module.exports = {
  LINE_CHANNEL_SECRET,
  LINE_CHANNEL_ACCESS_TOKEN
};
