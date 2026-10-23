import { isFirebaseConfigured, auth } from "./firebase";
import { AppError, toAppError } from "./errors";
import { normalizeMobile } from "../utils/validation";

/**
 * Mobile-number + password authentication adapter.
 *
 * Firebase's native phone sign-in is OTP based; it has no mobile+password
 * method. To keep a real, secure auth flow (no plaintext passwords, no fake
 * login) we use Firebase Email/Password as the credential store and derive a
 * stable internal identifier from the normalised mobile number:
 *
 *     mobile "9876543210"  ->  internal account "m9876543210@chat.local"
 *
 * - The password is hashed and managed entirely by Firebase Authentication.
 *   It is NEVER written to Firestore or to any custom field.
 * - Mobile-number uniqueness is guaranteed by the internal identifier being
 *   unique in Firebase Auth (duplicate signup -> "already in use").
 */

const INTERNAL_DOMAIN = "chat.local";

function internalEmail(mobileNumber) {
    return `m${normalizeMobile(mobileNumber)}@${INTERNAL_DOMAIN}`;
}

function requireConfigured() {
    if (!isFirebaseConfigured || !auth) {
        throw new AppError(
            "config/missing",
            "Firebase is not configured. Copy .env.example to .env and add your Firebase keys."
        );
    }
}

async function reauthenticate(currentPassword) {
    requireConfigured();
    const user = auth.currentUser;
    if (!user?.email) {
        throw new AppError("auth/no-user", "Your session expired. Sign in again.");
    }
    if (!currentPassword) {
        throw new AppError("validation/current-password", "Enter your current password.");
    }

    const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
    try {
        await reauthenticateWithCredential(
            user,
            EmailAuthProvider.credential(user.email, currentPassword)
        );
        return user;
    } catch (error) {
        const appError = toAppError(error, "Could not verify your password.");
        if (
            ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(
                appError.code
            )
        ) {
            throw new AppError(
                "validation/current-password",
                "Current password is incorrect."
            );
        }
        throw appError;
    }
}

const firebaseAdapter = {
    id: "firebase-email-password",

    async register({ displayName, mobileNumber, password }) {
        requireConfigured();
        const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
        try {
            const cred = await createUserWithEmailAndPassword(
                auth,
                internalEmail(mobileNumber),
                password
            );
            const name = displayName.trim();
            await updateProfile(cred.user, { displayName: name });
            return {
                uid: cred.user.uid,
                displayName: name,
                mobileNumber: normalizeMobile(mobileNumber)
            };
        } catch (error) {
            throw toAppError(error, "Could not create the account.");
        }
    },

    async login({ mobileNumber, password }) {
        requireConfigured();
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        try {
            const cred = await signInWithEmailAndPassword(
                auth,
                internalEmail(mobileNumber),
                password
            );
            return { uid: cred.user.uid, mobileNumber: normalizeMobile(mobileNumber) };
        } catch (error) {
            throw toAppError(error, "Could not sign in.");
        }
    },

    async changeMobileNumber({ newMobileNumber, currentPassword }) {
        const user = await reauthenticate(currentPassword);
        const previousEmail = user.email || "";
        const nextEmail = internalEmail(newMobileNumber);
        if (previousEmail === nextEmail) {
            return { changed: false, previousEmail };
        }

        const { updateEmail } = await import("firebase/auth");
        try {
            await updateEmail(user, nextEmail);
            await user.getIdToken(true);
            return { changed: true, previousEmail };
        } catch (error) {
            const appError = toAppError(error, "Could not change the mobile number.");
            if (
                appError.code === "auth/operation-not-allowed" &&
                /verify the new email/i.test(String(error?.message || ""))
            ) {
                throw new AppError(
                    "auth/email-enumeration-protection",
                    "Mobile change is blocked by Firebase settings. Turn off Email enumeration protection in Authentication settings, then retry."
                );
            }
            throw appError;
        }
    },

    async restoreMobileNumber(previousEmail) {
        if (!auth?.currentUser || !previousEmail) return;
        const { updateEmail } = await import("firebase/auth");
        await updateEmail(auth.currentUser, previousEmail);
        await auth.currentUser.getIdToken(true);
    },

    async changePassword({ currentPassword, newPassword }) {
        const user = await reauthenticate(currentPassword);
        const { updatePassword } = await import("firebase/auth");
        try {
            await updatePassword(user, newPassword);
        } catch (error) {
            throw toAppError(error, "Could not change the password.");
        }
    },

    async logout() {
        if (!auth) return;
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
    },

    async deleteAccount() {
        if (!auth?.currentUser) return;
        const { deleteUser, signOut } = await import("firebase/auth");
        await deleteUser(auth.currentUser);
        await signOut(auth).catch(() => {});
    },

    observe(callback) {
        if (!auth) {
            callback(null);
            return () => {};
        }
        let active = true;
        let unsub = () => {};
        import("firebase/auth").then(({ onAuthStateChanged }) => {
            if (!active) return;
            unsub = onAuthStateChanged(auth, (user) => callback(user));
        });
        return () => {
            active = false;
            unsub();
        };
    }
};

export const authAdapter = firebaseAdapter;
export { internalEmail };
