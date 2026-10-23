import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, LogOut, Pencil, Phone, X } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { ThemeToggle } from "../components/ThemeToggle";
import { Avatar } from "../components/Avatar";
import { Field } from "../components/Field";
import { Spinner } from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { userService } from "../services/userService";
import { storageStatus, uploadFile } from "../services/storageAdapter";
import { validateDisplayName, validateBio, validateFile } from "../utils/validation";
import { limits } from "../config/app";

export default function ProfilePage() {
    const { uid, profile, logout } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(profile?.displayName || "");
    const [bio, setBio] = useState(profile?.bio || "");
    const [saving, setSaving] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [error, setError] = useState("");
    const photoRef = useRef(null);

    useEffect(() => {
        if (editing) return;
        setDisplayName(profile?.displayName || "");
        setBio(profile?.bio || "");
    }, [profile, editing]);

    function startEditing() {
        setDisplayName(profile?.displayName || "");
        setBio(profile?.bio || "");
        setError("");
        setEditing(true);
    }

    function cancelEditing() {
        setEditing(false);
        setError("");
        setDisplayName(profile?.displayName || "");
        setBio(profile?.bio || "");
    }

    async function handleSave() {
        const nameError = validateDisplayName(displayName);
        if (nameError) {
            setError(nameError);
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
            await userService.updateProfile(uid, {
                displayName: displayName.trim(),
                bio: bio.trim()
            });
            toast.success("Profile updated.");
            setEditing(false);
        } catch (nextError) {
            setError(nextError.message || "Could not save your profile.");
            toast.error(nextError.message || "Could not save your profile.");
        } finally {
            setSaving(false);
        }
    }

    async function handlePhoto(file) {
        const validation = validateFile(file, "image");
        if (validation) {
            toast.error(validation);
            return;
        }
        const status = storageStatus();
        if (!status.configured) {
            toast.error(status.message);
            return;
        }

        setPhotoUploading(true);
        try {
            const { url } = await uploadFile(file, { folder: `avatars/${uid}` });
            await userService.updateProfile(uid, { photoURL: url });
            toast.success("Profile photo updated.");
        } catch (nextError) {
            toast.error(nextError.message || "Could not upload the photo.");
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
