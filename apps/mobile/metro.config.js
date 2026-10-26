// Expo's Metro config plus Sentry's serializer, which gives each bundle a debug ID so uploaded
// source maps match it (docs/deploy.md, Monitoring).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
