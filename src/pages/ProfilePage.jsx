import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, KeyRound, LogOut, Pencil, Phone, Type, X } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { ThemeToggle } from "../components/ThemeToggle";
import { Avatar } from "../components/Avatar";
import { Field } from "../components/Field";
import { PasswordInput } from "../components/PasswordInput";
import { Spinner } from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authService } from "../services/authService";
import { userService } from "../services/userService";
import { createAvatarDataUrl } from "../utils/avatar";
import {
    isValidMobile,
    normalizeMobile,
    validateDisplayName,
    validateBio,
    validateFile,
    validatePassword
} from "../utils/validation";
import { limits } from "../config/app";
import { APP_FONTS, getAppFont } from "../config/fonts";
import { getSavedFont, saveFont } from "../utils/fontPreference";

export default function ProfilePage() {
    const { uid, profile, logout } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(profile?.displayName || "");
    const [mobileNumber, setMobileNumber] = useState(profile?.mobileNumber || "");
    const [bio, setBio] = useState(profile?.bio || "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [fontId, setFontId] = useState(() => getSavedFont(uid));
    const [error, setError] = useState("");
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [passwordCurrent, setPasswordCurrent] = useState("");
    const [passwordNext, setPasswordNext] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);
    const photoRef = useRef(null);

    const mobileChanged =
        normalizeMobile(mobileNumber) !== normalizeMobile(profile?.mobileNumber || "");

    function resetPasswordForm() {
        setPasswordCurrent("");
        setPasswordNext("");
        setPasswordConfirm("");
        setPasswordError("");
    }

    useEffect(() => {
        if (editing) return;
        setDisplayName(profile?.displayName || "");
        setMobileNumber(profile?.mobileNumber || "");
        setBio(profile?.bio || "");
    }, [profile, editing]);

    function startEditing() {
        setDisplayName(profile?.displayName || "");
        setMobileNumber(profile?.mobileNumber || "");
        setBio(profile?.bio || "");
        setCurrentPassword("");
        setError("");
        setEditing(true);
    }

    function cancelEditing() {
        setEditing(false);
        setError("");
        setCurrentPassword("");
        setDisplayName(profile?.displayName || "");
        setMobileNumber(profile?.mobileNumber || "");
        setBio(profile?.bio || "");
    }

    async function handleSave() {
        const nameError = validateDisplayName(displayName);
        if (nameError) {
            setError(nameError);
            return;
        }
        const nextMobile = normalizeMobile(mobileNumber);
        if (mobileChanged && !isValidMobile(nextMobile)) {
            setError("Enter a valid mobile number (7–15 digits).");
            return;
        }
        if (mobileChanged && !currentPassword) {
            setError("Enter your current password to change the mobile number.");
            return;
        }
        const bioError = validateBio(bio);
        if (bioError) {
            setError(bioError);
            return;
        }

        setSaving(true);
        setError("");
        try {
            if (mobileChanged) {
                await authService.changeMobileNumber({
                    uid,
                    newMobileNumber: nextMobile,
                    currentPassword
                });
            }
            await userService.updateProfile(uid, {
                displayName: displayName.trim(),
                bio: bio.trim()
            });
            setCurrentPassword("");
            toast.success(mobileChanged ? "Profile and mobile number updated." : "Profile updated.");
            setEditing(false);
        } catch (nextError) {
            setError(nextError.message || "Could not save your profile.");
            toast.error(nextError.message || "Could not save your profile.");
        } finally {
            setSaving(false);
        }
    }

    async function handlePasswordChange() {
        setPasswordError("");
        if (!passwordCurrent) {
            setPasswordError("Enter your current password.");
            return;
        }
        const passwordValidation = validatePassword(passwordNext);
        if (passwordValidation) {
            setPasswordError(passwordValidation);
            return;
        }
        if (passwordNext !== passwordConfirm) {
            setPasswordError("New passwords do not match.");
            return;
        }

        setPasswordSaving(true);
        try {
            await authService.changePassword({
                currentPassword: passwordCurrent,
                newPassword: passwordNext
            });
            resetPasswordForm();
            setPasswordOpen(false);
            toast.success("Password changed.");
        } catch (nextError) {
            setPasswordError(nextError.message || "Could not change the password.");
        } finally {
            setPasswordSaving(false);
        }
    }

    function togglePasswordForm() {
        resetPasswordForm();
        setPasswordOpen((open) => !open);
    }

    function handleFontChange(nextFontId) {
        if (nextFontId === fontId) return;
        const nextFont = getAppFont(nextFontId);
        document.documentElement.style.setProperty("--app-font-family", nextFont.family);
        if (!saveFont(uid, nextFont.id)) {
            document.documentElement.style.setProperty(
                "--app-font-family",
                getAppFont(fontId).family
            );
            toast.error("Could not save your font choice on this device.");
            return;
        }
        setFontId(nextFont.id);
        toast.success(`${nextFont.name} font applied to your app.`);
    }

    async function handlePhoto(file) {
        const validation = validateFile(file, "image");
        if (validation) {
            toast.error(validation);
            return;
        }
        setPhotoUploading(true);
        try {
            const photoURL = await createAvatarDataUrl(file);
            await userService.updateProfile(uid, { photoURL });
            toast.success("Profile photo updated.");
        } catch (nextError) {
            toast.error(nextError.message || "Could not update the photo.");
        } finally {
            setPhotoUploading(false);
        }
    }

    async function handleLogout() {
        try {
            await logout();
            navigate("/login", { replace: true });
        } catch (nextError) {
            toast.error(nextError.message || "Could not sign out.");
        }
    }

    return (
        <>
            <AppHeader
                title="Profile"
                subtitle="Your account and about"
                actions={<ThemeToggle />}
            />

            <main className="mx-auto w-full max-w-xl px-4 py-5">
                <section className="panel overflow-hidden">
                    <div className="h-24 bg-gradient-to-br from-[#2a2350] via-[#4f6bed] to-[#8b5cf6]" />
                    <div className="px-4 pb-4">
                        <div className="-mt-11 flex items-end justify-between gap-2">
                            <div className="relative">
                                <Avatar
                                    name={profile?.displayName}
                                    src={profile?.photoURL}
                                    uid={uid}
                                    size="xl"
                                    className="rounded-full ring-4 ring-card"
                                />
                                <button
                                    type="button"
                                    onClick={() => photoRef.current?.click()}
                                    disabled={photoUploading}
                                    className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-card bg-accent text-white disabled:opacity-60"
                                    aria-label="Change profile photo"
                                >
                                    {photoUploading ? (
                                        <Spinner className="size-3.5" />
                                    ) : (
                                        <Camera className="size-4" />
                                    )}
                                </button>
                                <input
                                    ref={photoRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        event.target.value = "";
                                        if (file) handlePhoto(file);
                                    }}
                                />
                            </div>

                            {!editing ? (
                                <button
                                    type="button"
                                    onClick={startEditing}
                                    className="btn btn-outline btn-sm"
                                >
                                    <Pencil className="size-3.5" /> Edit
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="btn btn-ghost btn-sm"
                                    disabled={saving}
                                >
                                    <X className="size-3.5" /> Cancel
                                </button>
                            )}
                        </div>

                        <div className="mt-3">
                            <h1 className="text-lg font-bold leading-tight">
                                {profile?.displayName || "User"}
                            </h1>
                            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                                <Phone className="size-3.5" />
                                {profile?.mobileNumber || "Mobile number not set"}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="panel mt-4 p-4">
                    {editing ? (
                        <div className="space-y-4">
                            <Field
                                label="User name"
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                maxLength={limits.displayNameMaxLength}
                                placeholder="Your display name"
                            />
                            <div className="space-y-4">
                                <Field
                                    label="Mobile number"
                                    type="tel"
                                    inputMode="numeric"
                                    autoComplete="tel"
                                    value={mobileNumber}
                                    onChange={(event) => setMobileNumber(event.target.value)}
                                    placeholder="98765 43210"
                                    hint="This becomes your login number."
                                />
                                {mobileChanged ? (
                                    <PasswordInput
                                        label="Current password"
                                        autoComplete="current-password"
                                        placeholder="Enter current password"
                                        value={currentPassword}
                                        onChange={(event) =>
                                            setCurrentPassword(event.target.value)
                                        }
                                        hint="Required to change your mobile number."
                                    />
                                ) : null}
                            </div>
                            <Field
                                as="textarea"
                                label="Bio / About"
                                rows={3}
                                value={bio}
                                onChange={(event) => setBio(event.target.value)}
                                maxLength={limits.bioMaxLength}
                                placeholder="Tell others a little about you"
                                hint={`${bio.length} / ${limits.bioMaxLength}`}
                            />
                            {error ? (
                                <p className="text-xs text-danger" role="alert">
                                    {error}
                                </p>
                            ) : null}
                            <button
                                type="button"
                                className="btn btn-primary btn-full"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? <Spinner className="size-4" /> : null}
                                {saving ? "Saving…" : "Save changes"}
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xs font-bold uppercase tracking-wide text-muted">
                                About
                            </h2>
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                                {profile?.bio || "No bio yet. Tap Edit to add a short introduction."}
                            </p>
                        </>
                    )}
                </section>

                <section className="panel mt-4 p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                            <Type className="size-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-bold">App text font</h2>
                            <p className="mt-0.5 text-xs text-muted">
                                Choose a style for your app text. It stays saved on this device.
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {APP_FONTS.map((font) => {
                            const selected = fontId === font.id;
                            return (
                                <button
                                    key={font.id}
                                    type="button"
                                    onClick={() => handleFontChange(font.id)}
                                    aria-pressed={selected}
                                    className={`rounded-lg border p-3 text-left transition-colors ${
                                        selected
                                            ? "border-accent bg-accent/5 ring-1 ring-accent"
                                            : "border-line hover:border-accent/60"
                                    }`}
                                    style={{ fontFamily: font.family }}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold">{font.name}</span>
                                        {selected ? (
                                            <Check className="size-4 shrink-0 text-accent" aria-label="Selected" />
                                        ) : null}
                                    </span>
                                    <span className="mt-0.5 block text-2xs text-muted">
                                        {font.style}
                                    </span>
                                    <span className="mt-2 block truncate text-sm">
                                        Clear, comfortable reading · साफ़ पढ़ाई
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-2xs text-muted" aria-live="polite">
                        Saved on this device for this account · applies across chat, voice, video, and profile.
                    </p>
                </section>

                <section className="panel mt-4 p-4">
                    {passwordOpen ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-sm font-bold">Change password</h2>
                                <button
                                    type="button"
                                    onClick={togglePasswordForm}
                                    className="btn btn-ghost btn-sm"
                                    disabled={passwordSaving}
                                >
                                    <X className="size-3.5" /> Cancel
                                </button>
                            </div>
                            <PasswordInput
                                label="Current password"
                                autoComplete="current-password"
                                placeholder="Enter current password"
                                value={passwordCurrent}
                                onChange={(event) => setPasswordCurrent(event.target.value)}
                            />
                            <PasswordInput
                                label="New password"
                                autoComplete="new-password"
                                placeholder="At least 8 characters"
                                value={passwordNext}
                                onChange={(event) => setPasswordNext(event.target.value)}
                                hint="Use 8+ characters with a number."
                            />
                            <PasswordInput
                                label="Confirm new password"
                                autoComplete="new-password"
                                placeholder="Repeat new password"
                                value={passwordConfirm}
                                onChange={(event) => setPasswordConfirm(event.target.value)}
                            />
                            {passwordError ? (
                                <p className="text-xs text-danger" role="alert">
                                    {passwordError}
                                </p>
                            ) : null}
                            <button
                                type="button"
                                className="btn btn-primary btn-full"
                                onClick={handlePasswordChange}
                                disabled={passwordSaving}
                            >
                                {passwordSaving ? <Spinner className="size-4" /> : null}
                                {passwordSaving ? "Updating…" : "Update password"}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold">Password</h2>
                                <p className="mt-0.5 text-xs text-muted">
                                    Change your sign-in password.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={togglePasswordForm}
                                className="btn btn-outline btn-sm"
                            >
                                <KeyRound className="size-3.5" /> Change
                            </button>
                        </div>
                    )}
                </section>

                <button
                    type="button"
                    className="btn btn-outline btn-full mt-5 text-danger hover:border-danger hover:text-danger"
                    onClick={handleLogout}
                >
                    <LogOut className="size-4" /> Logout
                </button>

                <p className="mt-4 px-2 text-center text-2xs leading-relaxed text-muted">
                    Your password is managed by Firebase Authentication and is never stored in
                    Firestore.
                </p>
            </main>
        </>
    );
}
