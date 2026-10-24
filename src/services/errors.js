export class AppError extends Error {
    constructor(code, message, cause) {
        super(message);
        this.name = "AppError";
        this.code = code;
        if (cause) this.cause = cause;
    }
}

const MESSAGES = {
    "auth/email-already-in-use": "This mobile number is already registered.",
    "auth/invalid-credential": "Incorrect mobile number or password.",
    "auth/wrong-password": "Incorrect mobile number or password.",
    "auth/user-not-found": "Incorrect mobile number or password.",
    "auth/invalid-email": "This mobile number could not be used. Check the digits.",
    "auth/missing-password": "Enter your password.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/weak-password": "Password is too weak.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/invalid-api-key": "Firebase API key is invalid. Check your .env file.",
    "auth/operation-not-allowed": "This action is disabled in Firebase Authentication settings.",
    "auth/requires-recent-login": "Please sign in again to continue.",
    "storage/unauthorized": "Storage permission denied. Check storage.rules.",
    "storage/not-configured": "File storage is not configured yet.",
    "storage/upload-failed": "Upload failed. Please try again.",
    "permission-denied": "You do not have permission to do that.",
    "unavailable": "Service unavailable. Check your connection."
};

export function toAppError(error, fallback = "Something went wrong.") {
    if (error instanceof AppError) return error;
    const code = error?.code || "unknown";
    const message = MESSAGES[code] || MESSAGES[code.split("/").pop()] || fallback;
    return new AppError(code, message, error);
}
