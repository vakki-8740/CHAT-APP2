import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { env, isFirebaseConfigured, emulator } from "../config/env";

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
    app = getApps().length ? getApp() : initializeApp(env.firebase);
    auth = getAuth(app);
    db = getFirestore(app);

    if (emulator.enabled && !globalThis.__chatEmulatorsConnected) {
        connectAuthEmulator(auth, `http://${emulator.host}:${emulator.authPort}`, {
            disableWarnings: true
        });
        connectFirestoreEmulator(db, emulator.host, emulator.firestorePort);
        globalThis.__chatEmulatorsConnected = true;
    }
}

export { app, auth, db };
export { isFirebaseConfigured };
