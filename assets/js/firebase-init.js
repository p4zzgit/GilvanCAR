import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Configuração robusta para Firestore em ambientes restritos
const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true, // Ajuda em ambientes com firewalls/proxies
    useFetchStreams: false // Pode ajudar na estabilidade
}, firebaseConfig.firestoreDatabaseId || '(default)');

const auth = getAuth(app);

window.db = db;
window.auth = auth;

export { db, auth };
