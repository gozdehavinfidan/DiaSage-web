// QR Login Modal + linkSessions flow.
//
// Exports openQRModal() + closeQRModal() that drive the #qr-login-modal
// element in index.html. Flow:
//  1. Open modal → if user already signed in, skip to QR step
//     otherwise show email/password login form.
//  2. User signs in → create linkSessions doc → render QR.
//  3. Listen for patientUid confirmation on the linkSessions doc.
//  4. On confirmation, transition to patient monitor (openMonitor imported lazily).
//
// Uses global QRCode (from qrcodejs CDN) and firebase (compat SDK) from window scope.

import { fbAuth, fbDb } from '../../shared/firebase-init.js';
import { openMonitor } from './patient-monitor.js';

let qrSessionUnsubscribe = null;
let qrExpiryTimer = null;
let qrCountdownTimer = null;
let qrAuthUnsubscribe = null;
let isDoctorRegisterMode = false;
let modalClickBound = false;

export function openQRModal() {
  const modal = document.getElementById('qr-login-modal');
  const loginContent = document.getElementById('qrLoginContent');
  const qrContent = document.getElementById('qrContent');
  const success = document.getElementById('qrSuccess');
  if (!modal) return;

  success.classList.remove('show');
  document.getElementById('qrAuthError').textContent = '';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Bind backdrop click-to-close once
  if (!modalClickBound) {
    modal.addEventListener('click', function (e) {
      if (e.target === this) closeQRModal();
    });
    modalClickBound = true;
  }

  // Wait for Firebase to restore auth session before deciding view
  loginContent.style.display = 'none';
  qrContent.style.display = 'none';
  if (qrAuthUnsubscribe) { qrAuthUnsubscribe(); qrAuthUnsubscribe = null; }
  qrAuthUnsubscribe = fbAuth.onAuthStateChanged(function (user) {
    if (qrAuthUnsubscribe) { qrAuthUnsubscribe(); qrAuthUnsubscribe = null; }
    if (!modal.classList.contains('open')) return;
    if (user) {
      loginContent.style.display = 'none';
      qrContent.style.display = 'block';
      generateQRSession(user);
    } else {
      loginContent.style.display = 'block';
      qrContent.style.display = 'none';
    }
  });
}

export function closeQRModal() {
  if (qrAuthUnsubscribe) { qrAuthUnsubscribe(); qrAuthUnsubscribe = null; }
  if (qrSessionUnsubscribe) { qrSessionUnsubscribe(); qrSessionUnsubscribe = null; }
  if (qrExpiryTimer) { clearTimeout(qrExpiryTimer); qrExpiryTimer = null; }
  if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
  const modal = document.getElementById('qr-login-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

// Toggle login/register mode
export function toggleDoctorAuthMode() {
  isDoctorRegisterMode = !isDoctorRegisterMode;
  document.getElementById('qrNameGroup').style.display = isDoctorRegisterMode ? 'block' : 'none';
  document.getElementById('qrAuthTitle').textContent = isDoctorRegisterMode ? 'Doktor Kayıt' : 'Doktor Girişi';
  document.getElementById('qrAuthBtn').textContent = isDoctorRegisterMode ? 'Kayıt Ol' : 'Giriş Yap';
  document.getElementById('qrToggleText').textContent = isDoctorRegisterMode ? 'Zaten hesabınız var mı?' : 'Hesabınız yok mu?';
  document.getElementById('qrToggleLink').textContent = isDoctorRegisterMode ? 'Giriş Yap' : 'Kayıt Ol';
  document.getElementById('qrAuthError').textContent = '';
  document.getElementById('qrDoctorPassword').autocomplete = isDoctorRegisterMode ? 'new-password' : 'current-password';
}

// Handle doctor login/register
export async function handleDoctorAuth() {
  const email = document.getElementById('qrDoctorEmail').value.trim();
  const password = document.getElementById('qrDoctorPassword').value;
  const name = document.getElementById('qrDoctorName').value.trim();
  const errorEl = document.getElementById('qrAuthError');
  const btn = document.getElementById('qrAuthBtn');
  errorEl.textContent = '';
  if (!email || !password) { errorEl.textContent = 'E-posta ve şifre gerekli.'; return; }
  if (isDoctorRegisterMode && !name) { errorEl.textContent = 'Ad soyad gerekli.'; return; }
  btn.disabled = true;
  btn.textContent = isDoctorRegisterMode ? 'Kayıt yapılıyor...' : 'Giriş yapılıyor...';
  try {
    let userCred;
    if (isDoctorRegisterMode) {
      userCred = await fbAuth.createUserWithEmailAndPassword(email, password);
      await userCred.user.updateProfile({ displayName: name });
      await fbDb.collection('doctors').doc(userCred.user.uid).set({
        email: email,
        displayName: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      userCred = await fbAuth.signInWithEmailAndPassword(email, password);
    }
    // Success — switch to QR view
    document.getElementById('qrLoginContent').style.display = 'none';
    document.getElementById('qrContent').style.display = 'block';
    generateQRSession(userCred.user);
  } catch (err) {
    let msg = 'Bir hata oluştu.';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Geçersiz e-posta veya şifre.';
    else if (err.code === 'auth/email-already-in-use') msg = 'Bu e-posta zaten kayıtlı.';
    else if (err.code === 'auth/weak-password') msg = 'Şifre en az 6 karakter olmalı.';
    else if (err.code === 'auth/invalid-email') msg = 'Geçersiz e-posta adresi.';
    errorEl.textContent = msg;
  } finally {
    btn.disabled = false;
    btn.textContent = isDoctorRegisterMode ? 'Kayıt Ol' : 'Giriş Yap';
  }
}

// Generate random hex token
function generateToken(len) {
  const arr = new Uint8Array(len / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

// Generate QR session and display QR code
async function generateQRSession(user) {
  const qrContainer = document.getElementById('qrCanvas');
  const timerEl = document.getElementById('qrTimer');
  // Clear old QR immediately so stale code can't be scanned during Firestore write
  qrContainer.innerHTML = '';
  timerEl.textContent = '';
  if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
  if (qrSessionUnsubscribe) { qrSessionUnsubscribe(); qrSessionUnsubscribe = null; }
  if (qrExpiryTimer) { clearTimeout(qrExpiryTimer); qrExpiryTimer = null; }
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : generateToken(32);
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  // Create Firestore link session
  try {
    await fbDb.collection('linkSessions').doc(sessionId).set({
      doctorUid: user.uid,
      doctorEmail: user.email || '',
      doctorName: user.displayName || '',
      status: 'pending',
      token: token,
      createdAt: Date.now(),
      expiresAt: expiresAt.getTime()
    });
  } catch (err) {
    console.error('Firestore session create error:', err);
    document.getElementById('qrSpinner').querySelector('span').textContent = 'Oturum oluşturulamadı. Tekrar deneyin.';
    return;
  }
  // Generate QR code
  const deepLink = 'diaagent://link?sessionId=' + encodeURIComponent(sessionId) + '&token=' + encodeURIComponent(token);
  qrContainer.innerHTML = '';
  // eslint-disable-next-line no-new, no-undef
  new QRCode(qrContainer, { text: deepLink, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  // Countdown timer
  function updateCountdown() {
    const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    timerEl.textContent = 'Kalan süre: ' + min + ':' + (sec < 10 ? '0' : '') + sec;
    if (remaining <= 0) {
      clearInterval(qrCountdownTimer);
      timerEl.textContent = 'Süre doldu. Yeni QR oluşturmak için modalı kapatıp tekrar açın.';
      if (qrSessionUnsubscribe) { qrSessionUnsubscribe(); qrSessionUnsubscribe = null; }
    }
  }
  updateCountdown();
  qrCountdownTimer = setInterval(updateCountdown, 1000);
  // Listen for patient confirmation
  qrSessionUnsubscribe = fbDb.collection('linkSessions').doc(sessionId).onSnapshot(function (doc) {
    if (!doc.exists) return;
    const data = doc.data();
    if (data.status === 'confirmed') {
      if (qrSessionUnsubscribe) { qrSessionUnsubscribe(); qrSessionUnsubscribe = null; }
      if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
      // Show success
      document.getElementById('qrContent').style.display = 'none';
      document.getElementById('qrSuccess').classList.add('show');
      // Extract patient UID from confirmed session
      const confirmedPatientUid = data.patientUid;
      if (!confirmedPatientUid) {
        console.error('Confirmed session missing patientUid', data);
        return;
      }
      // Transition to patient monitor after 2 seconds
      setTimeout(function () {
        closeQRModal();
        openMonitor(confirmedPatientUid);
      }, 2000);
    }
  }, function (error) {
    console.error('QR listener error:', error);
    timerEl.textContent = 'Bağlantı hatası. Modalı kapatıp tekrar deneyin.';
    if (qrCountdownTimer) { clearInterval(qrCountdownTimer); qrCountdownTimer = null; }
  });
  // Auto-expire after 30 minutes
  qrExpiryTimer = setTimeout(function () {
    if (qrSessionUnsubscribe) { qrSessionUnsubscribe(); qrSessionUnsubscribe = null; }
  }, 30 * 60 * 1000);
}
