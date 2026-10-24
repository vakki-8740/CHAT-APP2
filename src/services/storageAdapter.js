import { isStorageConfigured, env, emulator } from "../config/env";
import { AppError } from "./errors";
import { extensionForMime } from "../utils/files";

/**
 * Storage adapter boundary.
 *
 * Firestore never stores binary data. File bytes are uploaded through one of
 * these adapters and only the resulting URL + metadata go into Firestore.
 *
 *   - "http"     : POST to VITE_UPLOAD_ENDPOINT (multipart form-data), expects JSON { url }
 *   - "firebase" : Firebase Storage upload (auto-enabled when a bucket is set)
 *   - otherwise  : disabled, `uploadFile` rejects with a clear message
 */

function safeName(file) {
    const ext = extensionForMime(file.type);
    const base = String(file.name || "file")
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .slice(0, 48);
    const random = Math.random().toString(36).slice(2, 8);
    return `${Date.now()}-${random}-${base || "file"}.${ext}`;
}

async function uploadViaHttp(file, { folder }) {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);

    const headers = { Accept: "application/json" };
    if (env.storage.uploadToken) {
        headers.Authorization = `Bearer ${env.storage.uploadToken}`;
    } else {
        const { auth } = await import("./firebase");
        const token = await auth?.currentUser?.getIdToken().catch(() => null);
        if (!token) {
            throw new AppError(
                "storage/not-authenticated",
                "Your session expired. Sign in again to upload files."
            );
        }
        headers.Authorization = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(env.storage.uploadEndpoint, {
            method: "POST",
            headers,
            body: form
        });
    } catch (error) {
        throw new AppError(
            "storage/network",
            "Could not reach the upload server. Check the backend URL and CORS.",
            error
        );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new AppError(
            "storage/upload-failed",
            data?.error || `Upload failed (${res.status}).`
        );
    }
    if (!data.url)
        throw new AppError("storage/bad-response", "Upload endpoint did not return a url.");
    return { url: data.url, storagePath: data.path || "" };
}

async function uploadViaFirebase(file, { folder, onProgress }) {
    const { getStorage, ref, uploadBytesResumable, getDownloadURL, connectStorageEmulator } =
        await import("firebase/storage");
    const { app } = await import("./firebase");
    const storage = getStorage(app);
    if (emulator.enabled && !globalThis.__chatStorageEmulatorConnected) {
        connectStorageEmulator(storage, emulator.host, emulator.storagePort);
        globalThis.__chatStorageEmulatorConnected = true;
    }
    const path = `${folder}/${safeName(file)}`;
    const task = uploadBytesResumable(ref(storage, path), file, {
        contentType: file.type || "application/octet-stream"
    });
    return new Promise((resolve, reject) => {
        task.on(
            "state_changed",
            (snap) => {
                if (onProgress && snap.totalBytes) {
                    onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
                }
            },
            (err) => reject(new AppError("storage/upload-failed", err.message, err)),
            async () => {
                const url = await getDownloadURL(task.snapshot.ref);
                resolve({ url, storagePath: path });
            }
        );
    });
}

export function storageStatus() {
    if (!isStorageConfigured) {
        return {
            configured: false,
            provider: env.storage.provider || "none",
            message:
                "File uploads need storage. Add VITE_FIREBASE_STORAGE_BUCKET (or configure the HTTP uploader) and enable Firebase Storage."
        };
    }
    return { configured: true, provider: env.storage.provider, message: "" };
}

export async function uploadFile(file, { folder = "uploads", onProgress } = {}) {
    if (!isStorageConfigured) {
        throw new AppError(
            "storage/not-configured",
            "File storage is not configured. See README → Storage setup."
        );
    }
    if (env.storage.provider === "http") return uploadViaHttp(file, { folder, onProgress });
    if (env.storage.provider === "firebase")
        return uploadViaFirebase(file, { folder, onProgress });
    throw new AppError("storage/not-configured", "Unknown storage provider.");
}
