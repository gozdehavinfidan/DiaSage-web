// Authentication module - wraps Firebase Auth compat SDK.
// Exports sign-in helpers and an observer initializer.
//
// NOTE: The live site authentication flow is handled inside the QR login modal
// (src/features/dashboard/qr-link.js) which performs createUserWithEmailAndPassword
// and signInWithEmailAndPassword directly. The helpers here provide a cleaner
// programmatic surface if the UI ever needs to sign in/out from elsewhere.

import { fbAuth, fbDb } from '../../shared/firebase-init.js';

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 * @param {(user: firebase.User|null) => void} cb
 */
export function initAuth(cb) {
  return fbAuth.onAuthStateChanged(cb);
}

export function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return fbAuth.signInWithPopup(provider);
}

export async function signUpWithEmail(email, pw, name) {
  const userCred = await fbAuth.createUserWithEmailAndPassword(email, pw);
  if (name) {
    await userCred.user.updateProfile({ displayName: name });
    await fbDb.collection('doctors').doc(userCred.user.uid).set({
      email,
      displayName: name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  return userCred;
}

export function signInWithEmail(email, pw) {
  return fbAuth.signInWithEmailAndPassword(email, pw);
}

export function signOut() {
  return fbAuth.signOut();
}

export function getCurrentUser() {
  return fbAuth.currentUser;
}
