import { auth, isFirebaseConfigured } from "../services/firebase";
import { AppError, toAppError } from "../services/errors";
import { APP_LOCK_PIN } from "../config/app";

export const ADMIN_EMAIL = "admin@chat.local";
export const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN?.trim() || APP_LOCK_PIN;

function adminFirebasePassword(pin) {
    return `ChatAdminVault#${pin}`;
}

export async function signInAdmin(pin) {
    const cleanPin = String(pin || "").trim();
    if (!cleanPin) {
        throw new AppError("validation/pin", "Enter the Admin PIN.");
    }
    if (cleanPin !== ADMIN_PIN) {
        throw new AppError("auth/wrong-pin", "Incorrect Admin PIN.");
    }
    if (!isFirebaseConfigured || !auth) {
        throw new AppError("config/missing", "Firebase is not configured.");
    }

    const {
        signInWithEmailAndPassword,
        createUserWithEmailAndPassword,
        updateProfile
    } = await import("firebase/auth");

    const password = adminFirebasePassword(cleanPin);

    try {
        const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
        return cred.user;
    } catch (signInError) {
        const code = String(signInError?.code || "");
        if (
            code === "auth/user-not-found" ||
            code === "auth/invalid-credential" ||
            code === "auth/invalid-login-credentials"
        ) {
            try {
                const created = await createUserWithEmailAndPassword(
                    auth,
                    ADMIN_EMAIL,
                    password
                );
                await updateProfile(created.user, { displayName: "Admin" }).catch(
                    () => {}
                );
                return created.user;
            } catch (createError) {
                if (String(createError?.code || "") === "auth/email-already-in-use") {
                    throw new AppError(
                        "auth/admin-credential-mismatch",
                        "Admin account already exists in Firebase Auth with a different password."
                    );
                }
                throw toAppError(createError, "Could not initialize Admin session.");
            }
        }
        throw toAppError(signInError, "Could not sign in to Admin Panel.");
    }
}

export async function signOutAdmin() {
    if (!auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth).catch(() => {});
}
