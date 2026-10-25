import { limits } from "../config/app";
import { AppError } from "./errors";

export function resolveVideoStreamUrl(rawUrl, { download = false, fileName = "" } = {}) {
    const src = String(rawUrl || "").trim();
    if (!src) return "";
    if (src.startsWith("blob:") || src.startsWith("data:")) return src;

    const marker = "/api/video-stream?";
    const idx = src.indexOf(marker);
    if (idx !== -1) {
        const queryString = src.slice(idx + marker.length);
        const params = new URLSearchParams(queryString);
        if (download) {
            params.set("download", "1");
            if (fileName) params.set("name", fileName);
        }
        return `/api/video-stream?${params.toString()}`;
    }

    return src;
}

export async function uploadVideoToDrive(file, { chatKey, onProgress, signal } = {}) {
    if (!file) {
        throw new AppError("validation/file", "No video file selected.");
    }
    if (file.size <= 0) {
        throw new AppError("validation/file", "Selected video file is empty.");
    }
    if (file.size > limits.videoMaxBytes) {
        throw new AppError("validation/file", "Video must be 200 MB or smaller.");
    }

    const { auth } = await import("./firebase");
    const token = await auth?.currentUser?.getIdToken().catch(() => null);
    if (!token) {
        throw new AppError(
            "storage/not-authenticated",
            "Your session expired. Sign in again to upload videos."
        );
    }

    // 1. Request a 1-time CORS-enabled Google Drive Resumable Upload URL from our backend
    let initRes;
    try {
        initRes = await fetch("/api/video-upload", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                fileName: file.name || "video.mp4",
                mimeType: file.type || "",
                size: file.size,
                chatKey,
                origin: window.location.origin
            }),
            signal
        });
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new AppError("storage/cancelled", "Video upload cancelled.");
        }
        throw new AppError(
            "storage/network",
            "Could not reach the video upload server. Check your internet connection.",
            error
        );
    }

    const initData = await initRes.json().catch(() => ({}));
    if (!initRes.ok || !initData?.uploadUrl) {
        throw new AppError(
            "storage/upload-init-failed",
            initData?.error || `Could not start video upload (${initRes.status}).`
        );
    }

    const { uploadUrl, mimeType } = initData;

    // 2. Upload file bytes directly to Google Drive with live progress
    const uploadedMeta = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", mimeType || file.type || "video/mp4");

        const onAbort = () => {
            xhr.abort();
            reject(new AppError("storage/cancelled", "Video upload cancelled."));
        };
        if (signal) {
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener("abort", onAbort, { once: true });
        }

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
                onProgress({
                    percent: pct,
                    loaded: event.loaded,
                    total: event.total
                });
            }
        };

        xhr.onload = () => {
            signal?.removeEventListener?.("abort", onAbort);
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const parsed = JSON.parse(xhr.responseText || "{}");
                    if (parsed?.id) {
                        resolve(parsed);
                        return;
                    }
                } catch {
                    /* fall through */
                }
                reject(
                    new AppError(
                        "storage/bad-response",
                        "Google Drive completed the upload but did not return a file ID."
                    )
                );
                return;
            }
            reject(
                new AppError(
                    "storage/upload-failed",
                    `Google Drive upload failed (HTTP ${xhr.status}).`
                )
            );
        };

        xhr.onerror = () => {
            signal?.removeEventListener?.("abort", onAbort);
            reject(
                new AppError(
                    "storage/network",
                    "Network interrupted while uploading video to Google Drive."
                )
            );
        };

        xhr.onabort = () => {
            signal?.removeEventListener?.("abort", onAbort);
            reject(new AppError("storage/cancelled", "Video upload cancelled."));
        };

        xhr.send(file);
    });

    // 3. Finalize & sign permanent streaming URL
    const freshToken = (await auth?.currentUser?.getIdToken().catch(() => null)) || token;
    const finalRes = await fetch("/api/video-finalize", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${freshToken}`,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({
            driveFileId: uploadedMeta.id,
            chatKey
        }),
        signal
    });

    const finalData = await finalRes.json().catch(() => ({}));
    if (!finalRes.ok || !finalData?.url) {
        throw new AppError(
            "storage/finalize-failed",
            finalData?.error || "Could not finalize uploaded video."
        );
    }

    onProgress?.({ percent: 100, loaded: file.size, total: file.size });
    return {
        url: finalData.url,
        driveFileId: finalData.driveFileId,
        mimeType: finalData.mimeType || mimeType || file.type || "video/mp4",
        size: Number(finalData.size || file.size || 0)
    };
}
