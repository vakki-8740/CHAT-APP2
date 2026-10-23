import { authAdapter } from "./authAdapter";
import { userService } from "./userService";
import {
    isValidMobile,
    normalizeMobile,
    validateDisplayName,
    validatePassword
} from "../utils/validation";
import { AppError, toAppError } from "./errors";

export const authService = {
    /**
     * Registers with Firebase Auth (password hashed by Firebase) and creates
     * the Firestore profile. If the profile cannot be saved the auth account
     * is removed so no half-created accounts are left behind.
     */
    async register({ displayName, mobileNumber, password }) {
        const nameError = validateDisplayName(displayName);
        if (nameError) throw new AppError("validation/name", nameError);
        if (!isValidMobile(mobileNumber))
            throw new AppError("validation/mobile", "Enter a valid mobile number.");
        const passError = validatePassword(password);
        if (passError) throw new AppError("validation/password", passError);

        const { uid } = await authAdapter.register({ displayName, mobileNumber, password });
        try {
            return await userService.createProfile(uid, {
                displayName: displayName.trim(),
                mobileNumber: normalizeMobile(mobileNumber),
                photoURL: "",
                bio: ""
            });
        } catch (error) {
            await authAdapter.deleteAccount().catch(() => authAdapter.logout().catch(() => {}));
            throw error instanceof AppError
                ? error
                : toAppError(error, "Could not save your profile. Please try again.");
        }
    },

    async login({ mobileNumber, password }) {
        if (!isValidMobile(mobileNumber))
            throw new AppError("validation/mobile", "Enter a valid mobile number.");
        if (!password) throw new AppError("validation/password", "Enter your password.");

        const result = await authAdapter.login({ mobileNumber, password });
        const profile = await userService.getProfile(result.uid).catch(() => null);
        if (!profile) {
            await authAdapter.logout().catch(() => {});
            throw new AppError(
                "profile/missing",
                "No profile was found for this account. Please register again with a different number."
            );
        }
        return profile;
    },

    async changeMobileNumber({ uid, newMobileNumber, currentPassword }) {
        const nextMobile = normalizeMobile(newMobileNumber);
        if (!isValidMobile(nextMobile))
            throw new AppError("validation/mobile", "Enter a valid mobile number.");

        const profile = await userService.getProfile(uid);
        if (!profile) {
            throw new AppError("profile/missing", "Your profile could not be found.");
        }
        if (normalizeMobile(profile.mobileNumber) === nextMobile) return profile;

        const { changed, previousEmail } = await authAdapter.changeMobileNumber({
            newMobileNumber: nextMobile,
            currentPassword
        });

        try {
            await userService.updateMobileNumber(uid, nextMobile);
            return { ...profile, mobileNumber: nextMobile };
        } catch (error) {
            if (changed) {
                await authAdapter.restoreMobileNumber(previousEmail).catch(() => {});
            }
            throw error instanceof AppError
                ? error
                : toAppError(error, "Could not update the mobile number.");
        }
    },

    async changePassword({ currentPassword, newPassword }) {
        if (!currentPassword) {
            throw new AppError(
                "validation/current-password",
                "Enter your current password."
            );
        }
        const passwordError = validatePassword(newPassword);
        if (passwordError) throw new AppError("validation/password", passwordError);
        if (newPassword === currentPassword) {
            throw new AppError(
                "validation/password",
                "New password must be different from the current password."
            );
        }
        await authAdapter.changePassword({ currentPassword, newPassword });
    },

    logout() {
        return authAdapter.logout();
    },

    observe(callback) {
        return authAdapter.observe(callback);
    }
};
