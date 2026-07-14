import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDHTvoXRstIygUlJjb8HofN6KeJoB54lo4",
  authDomain: "gestaomecc.firebaseapp.com",
  databaseURL: "https://gestaomecc-default-rtdb.firebaseio.com",
  projectId: "gestaomecc",
  storageBucket: "gestaomecc.firebasestorage.app",
  messagingSenderId: "46840934416",
  appId: "1:46840934416:web:da142e61a7528f7acc1a95",
  measurementId: "G-1269GDW06X"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false
}, '(default)');

const auth = getAuth(app);
window.db = db;
window.auth = auth;

export { db, auth };
