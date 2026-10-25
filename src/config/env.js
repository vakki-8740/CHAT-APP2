function read(key, fallback = "") {
    const value = import.meta.env[key];
    return typeof value === "string" ? value.trim() : fallback;
}

const storageProvider = read("VITE_STORAGE_PROVIDER");

export const env = {
    firebase: {
        apiKey: read("VITE_FIREBASE_API_KEY"),
        authDomain: read("VITE_FIREBASE_AUTH_DOMAIN"),
        projectId: read("VITE_FIREBASE_PROJECT_ID"),
        appId: read("VITE_FIREBASE_APP_ID"),
        messagingSenderId: read("VITE_FIREBASE_MESSAGING_SENDER_ID"),
        storageBucket: read("VITE_FIREBASE_STORAGE_BUCKET")
    },
    storage: {
        // Defaults to permanent Firestore media encoding unless Firebase Storage
        // bucket or an explicit HTTP upload endpoint is configured.
        provider:
            storageProvider ||
            (read("VITE_FIREBASE_STORAGE_BUCKET") ? "firebase" : "firestore"),
        uploadEndpoint: read("VITE_UPLOAD_ENDPOINT"),
        uploadToken: read("VITE_UPLOAD_TOKEN")
    },
    call: {
        turnUrls: read("VITE_TURN_URL"),
        turnUsername: read("VITE_TURN_USERNAME"),
        turnCredential: read("VITE_TURN_CREDENTIAL")
    }
};

export const isFirebaseConfigured = Boolean(
    env.firebase.apiKey && env.firebase.projectId && env.firebase.appId
);

export const emulator = {
    // Emulators are allowed only in local development builds.
    enabled:
        !import.meta.env.PROD &&
        (read("VITE_USE_FIREBASE_EMULATORS") === "true" ||
            env.firebase.projectId.startsWith("demo-")),
    host: read("VITE_EMULATOR_HOST", "127.0.0.1") || "127.0.0.1",
    authPort: 9099,
    firestorePort: 8080,
    storagePort: 9199
};

export const isStorageConfigured =
    (env.storage.provider === "firestore" && isFirebaseConfigured) ||
    (env.storage.provider === "http" && Boolean(env.storage.uploadEndpoint)) ||
    (env.storage.provider === "firebase" && Boolean(env.firebase.storageBucket));
