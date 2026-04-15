// Initializes the Firebase compat SDK (loaded as globals from CDN <script> tags
// in each HTML file). Exports wrapped handles to avoid scattering `firebase.auth()`
// calls across the codebase.
//
// IMPORTANT: This module must be imported AFTER the firebase-*-compat.js script
// tags have executed. app.js is the orchestrator and handles that ordering.

import { firebaseConfig } from '../config/firebase-config.js';

if (!window.firebase) {
  throw new Error('Firebase compat SDK must be loaded via <script> tags before importing firebase-init.js');
}

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const fbAuth = firebase.auth();
export const fbDb = firebase.firestore();
export const fbAnalytics = (typeof firebase.analytics === 'function') ? firebase.analytics() : null;
