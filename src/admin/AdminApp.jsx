import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Cloud,
    Copy,
    Database,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    Film,
    Image as ImageIcon,
    LayoutDashboard,
    Lock,
    MessageSquare,
    Mic,
    Phone,
    PhoneCall,
    RefreshCw,
    Send,
    Settings2,
    ShieldAlert,
    ShieldCheck,
    Users,
    Video
} from "lucide-react";
import firestoreRulesRaw from "../../firestore.rules?raw";
import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider, useToast } from "../context/ToastContext";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";
import { Avatar } from "../components/Avatar";
import { SearchBar } from "../components/SearchBar";
import { VoicePlayer } from "../components/VoicePlayer";
import { VideoPlayerCard } from "../components/VideoPlayerCard";
import { ImageLightbox } from "../components/ImageLightbox";
import { Spinner } from "../components/LoadingScreen";
import { isFirebaseConfigured } from "../config/env";
import { auth } from "../services/firebase";
import { isOnline } from "../services/userService";
import { resolveVideoStreamUrl } from "../services/videoUploadService";
import { extensionForMime, formatBytes } from "../utils/files";
import { dataUrlToObjectUrl } from "../utils/media";
import { formatClock, formatDayLabel, formatTime, toDate } from "../utils/format";
import { cn } from "../utils/cn";
import SetupPage from "../pages/SetupPage";
import AdminLoginPage from "./AdminLoginPage";
import { signOutAdmin } from "./adminAuth";
import { saveVideoDriveScriptUrl, useAdminData } from "./adminDataService";

const TABS = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "chats", label: "Chats", icon: MessageSquare },
    { id: "images", label: "Images", icon: ImageIcon },
    { id: "voice", label: "Voice Packs", icon: Mic },
    { id: "videos", label: "Videos", icon: Film },
    { id: "calls", label: "Calls", icon: PhoneCall },
    { id: "telegram", label: "Telegram Alert", icon: Send }
];

function formatDateTime(value) {
    const date = toDate(value);
    if (!date) return "—";
    return `${formatDayLabel(date)} · ${formatTime(date)}`;
}

function triggerMediaDownload(src, baseName = "file") {
    if (!src) return;
    if (src.startsWith("data:")) {
        const mime = src.slice(5).split(";")[0];
        const ext = extensionForMime(mime);
        const objectUrl = dataUrlToObjectUrl(src);
        if (!objectUrl) return;
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `${baseName}.${ext === "bin" ? "dat" : ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
        return;
    }
    const a = document.createElement("a");
    a.href = src;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = baseName;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function serializeTimestamp(value) {
    const date = toDate(value);
    return date ? date.toISOString() : null;
}

function TelegramAlertPanel({ onCopyRules }) {
    const toast = useToast();
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [configured, setConfigured] = useState(false);
    const [botToken, setBotToken] = useState("");
    const [chatId, setChatId] = useState("");
    const [botUsername, setBotUsername] = useState("");
    const [updatedAt, setUpdatedAt] = useState("");
    const [unlockMessage, setUnlockMessage] = useState("User Online aaya hai 😁✳️✅");
    const [showToken, setShowToken] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [needsRulesSync, setNeedsRulesSync] = useState(false);

    const loadConfig = useCallback(async () => {
        setLoadingConfig(true);
        try {
            const idToken = await auth?.currentUser?.getIdToken().catch(() => "");
            const res = await fetch("/api/telegram-config", {
                method: "GET",
                headers: idToken ? { Authorization: `Bearer ${idToken}` } : {}
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setConfigured(Boolean(data.configured));
                setBotToken(data.botToken || "");
                setChatId(data.chatId || "");
                setBotUsername(data.botUsername || "");
                setUpdatedAt(data.updatedAt || "");
                if (data.unlockMessage) setUnlockMessage(data.unlockMessage);
            }
        } catch {
            /* ignore initial fetch error */
        } finally {
            setLoadingConfig(false);
        }
    }, []);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    async function handleSave() {
        const cleanToken = botToken.trim();
        const cleanChat = chatId.trim();
        if (!cleanToken) {
            toast.error("Telegram Bot Token dalein.");
            return;
        }
        if (!cleanChat) {
            toast.error("Telegram Channel / Chat ID dalein.");
            return;
        }

        setSaving(true);
        setNeedsRulesSync(false);
        try {
            const idToken = await auth?.currentUser?.getIdToken().catch(() => "");
            const res = await fetch("/api/telegram-config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
                },
                body: JSON.stringify({
                    action: "save",
                    botToken: cleanToken,
                    chatId: cleanChat
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                if (res.status === 403 && /Rules/i.test(String(data?.error || ""))) {
                    setNeedsRulesSync(true);
                }
                toast.error(data?.error || "Could not save Telegram settings.");
                return;
            }
            setConfigured(true);
            setBotToken(data.botToken || cleanToken);
            setChatId(data.chatId || cleanChat);
            setBotUsername(data.botUsername || "");
            setUpdatedAt(data.updatedAt || new Date().toISOString());
            toast.success("Telegram Bot Token & Chat ID saved successfully!");
        } catch (err) {
            toast.error(err?.message || "Could not save Telegram settings.");
        } finally {
            setSaving(false);
        }
    }

    async function handleSendTest() {
        setTesting(true);
        try {
            const idToken = await auth?.currentUser?.getIdToken().catch(() => "");
            const res = await fetch("/api/telegram-config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
                },
                body: JSON.stringify({
                    action: "test",
                    botToken: botToken.trim(),
                    chatId: chatId.trim()
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                toast.error(data?.error || "Could not send test message.");
                return;
            }
            if (data.botUsername) setBotUsername(data.botUsername);
            toast.success(data.message || "Test message sent to Telegram Channel!");
        } catch (err) {
            toast.error(err?.message || "Could not send test message.");
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <section className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span
                            className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                configured
                                    ? "bg-success/15 text-success"
                                    : "bg-accent-soft text-accent"
                            )}
                        >
                            <Send className="size-5" />
                        </span>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-bold">
                                    Telegram Unlock Notification
                                </h2>
                                {loadingConfig ? (
                                    <span className="rounded-full bg-bg px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                                        Loading…
                                    </span>
                                ) : configured ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                                        <CheckCircle2 className="size-3.5" />
                                        Active{botUsername ? ` · @${botUsername}` : ""}
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-[11px] font-semibold text-warn">
                                        Not Set Yet
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                                Jab bhi koi user App ka PIN daal kar page unlock karega, turant aapke Telegram Channel me message jayega.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Exact Message Preview */}
                <div className="mt-4 rounded-xl border border-line bg-bg p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Unlock Message (Auto-sent on every PIN unlock)
                    </p>
                    <p className="mt-1 text-sm font-bold text-ink">{unlockMessage}</p>
                </div>

                {needsRulesSync ? (
                    <div className="mt-4 flex flex-col justify-between gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3 sm:flex-row sm:items-center">
                        <p className="text-xs text-ink">
                            Pehle updated <strong>Firestore Rules</strong> copy karke{" "}
                            <strong>Firebase Console → Firestore Database → Rules</strong> me Publish kar dein, fir Save dabayein.
                        </p>
                        <button
                            type="button"
                            onClick={onCopyRules}
                            className="btn btn-outline btn-sm shrink-0 text-xs"
                        >
                            <Copy className="size-3.5" /> Copy Firestore Rules
                        </button>
                    </div>
                ) : null}

                <div className="mt-4 space-y-3.5">
                    <div>
                        <div className="mb-1.5 flex items-center justify-between">
                            <label className="text-xs font-bold text-ink">
                                Telegram Bot Token
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowToken((v) => !v)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
                            >
                                {showToken ? (
                                    <>
                                        <EyeOff className="size-3.5" /> Hide Token
                                    </>
                                ) : (
                                    <>
                                        <Eye className="size-3.5" /> Show Token
                                    </>
                                )}
                            </button>
                        </div>
                        <input
                            type="text"
                            value={botToken}
                            onChange={(e) => setBotToken(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ..."
                            style={
                                showToken
                                    ? undefined
                                    : { WebkitTextSecurity: "disc" }
                            }
                            className="input h-10 w-full font-mono text-xs"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-bold text-ink">
                            Telegram Channel / Chat ID
                        </label>
                        <input
                            type="text"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="-1001234567890  ya  @your_channel_username"
                            className="input h-10 w-full font-mono text-xs"
                        />
                    </div>

                    {updatedAt ? (
                        <p className="text-[11px] text-muted">
                            Last updated: {formatDateTime(updatedAt)}
                        </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || loadingConfig}
                            className="btn btn-primary btn-sm h-10 px-4"
                        >
                            {saving ? (
                                <>
                                    <Spinner className="size-4" /> Saving…
                                </>
                            ) : configured ? (
                                "Update Token & Chat ID"
                            ) : (
                                "Save Token & Chat ID"
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleSendTest}
                            disabled={testing || saving || loadingConfig}
                            className="btn btn-outline btn-sm h-10 px-4"
                        >
                            {testing ? (
                                <>
                                    <Spinner className="size-4" /> Sending…
                                </>
                            ) : (
                                <>
                                    <Send className="size-3.5" /> Send Test Message
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </section>

            <section className="panel p-4 text-xs text-muted space-y-2">
                <p className="font-bold text-ink">Quick Setup Tips:</p>
                <ol className="list-decimal space-y-1.5 pl-4 leading-relaxed">
                    <li>
                        Telegram par <strong>@BotFather</strong> se apna Bot Token lein aur upar paste karein.
                    </li>
                    <li>
                        Jis Telegram Channel me alert chahiye, us Channel ke{" "}
                        <strong>Administrators</strong> me apne Bot ko add karein (
                        <strong>Post Messages</strong> permission ON rakhein).
                    </li>
                    <li>
                        Public channel ke liye <code>@channel_username</code> dalein, ya Private channel ke liye uska{" "}
                        <code>-100...</code> wala Chat ID daal kar <strong>Save</strong> aur{" "}
                        <strong>Send Test Message</strong> check kar lein.
                    </li>
                </ol>
            </section>
        </div>
    );
}

function GoogleDriveSetupCard({ savedScriptUrl = "" }) {
    const toast = useToast();
    const [status, setStatus] = useState({
        loading: true,
        connected: false,
        folderName: "CHAT-APP2 Videos",
        folderUrl: "https://drive.google.com/drive/folders/1x_9dCsqU0rRaA99jQ0FQpmCxI5AG9gkt",
        maxMegabytes: 200,
        scriptCode: "",
        error: ""
    });
    const [scriptUrlInput, setScriptUrlInput] = useState(savedScriptUrl || "");
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (savedScriptUrl && !scriptUrlInput) {
            setScriptUrlInput(savedScriptUrl);
        }
    }, [savedScriptUrl, scriptUrlInput]);

    const checkDriveStatus = useCallback(async (overrideUrl = "") => {
        setStatus((prev) => ({ ...prev, loading: true }));
        try {
            const token = await auth?.currentUser?.getIdToken().catch(() => "");
            const res = await fetch("/api/video-status", {
                method: overrideUrl ? "POST" : "GET",
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(overrideUrl ? { "Content-Type": "application/json" } : {})
                },
                body: overrideUrl ? JSON.stringify({ scriptUrl: overrideUrl }) : undefined
            });
            const data = await res.json().catch(() => ({}));
            setStatus({
                loading: false,
                connected: Boolean(data?.connected),
                folderName: data?.folderName || "CHAT-APP2 Videos",
                folderUrl:
                    data?.folderUrl ||
                    "https://drive.google.com/drive/folders/1x_9dCsqU0rRaA99jQ0FQpmCxI5AG9gkt",
                maxMegabytes: data?.maxMegabytes || 200,
                scriptCode: data?.scriptCode || "",
                error: data?.error || ""
            });
            return data;
        } catch (err) {
            setStatus((prev) => ({
                ...prev,
                loading: false,
                connected: false,
                error: err?.message || "Could not check Google Drive status."
            }));
            return null;
        }
    }, []);

    useEffect(() => {
        checkDriveStatus();
    }, [checkDriveStatus, savedScriptUrl]);

    async function handleSaveAndConnect() {
        const clean = scriptUrlInput.trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/i.test(clean)) {
            toast.error("Valid Google Apps Script Web App URL dalein (jo /exec par khatam ho).");
            return;
        }
        setSaving(true);
        try {
            const testResult = await checkDriveStatus(clean);
            if (!testResult?.connected) {
                toast.error(
                    testResult?.error ||
                        "Script URL connect nahi ho paya. Check karein ki Deploy me 'Who has access: Anyone' select kiya hai."
                );
                return;
            }
            await saveVideoDriveScriptUrl(clean);
            toast.success("Google Drive 200 MB Video Storage connected permanently!");
            setExpanded(false);
        } catch (err) {
            toast.error(
                /permission/i.test(String(err?.message || ""))
                    ? "Pehle upar 'Copy Firestore Rules' karke Firebase Console me Publish karein, fir Save dabayein."
                    : err?.message || "Could not save Google Drive URL."
            );
        } finally {
            setSaving(false);
        }
    }

    function copyAppsScript() {
        if (!status.scriptCode) {
            toast.error("Script abhi load ho raha hai, ek second baad try karein.");
            return;
        }
        navigator.clipboard
            ?.writeText(status.scriptCode)
            .then(() =>
                toast.success("Google Drive Script copied! Ab script.google.com par paste karein.")
            )
            .catch(() => toast.error("Could not copy script."));
    }

    const showSetup = !status.loading && (!status.connected || expanded);

    return (
        <section className="panel mb-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <span
                        className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            status.connected
                                ? "bg-success/15 text-success"
                                : "bg-accent-soft text-accent"
                        )}
                    >
                        <Cloud className="size-5" />
                    </span>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-bold">
                                Google Drive Video Storage (Max {status.maxMegabytes} MB)
                            </h2>
                            {status.loading ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-muted">
                                    Checking…
                                </span>
                            ) : status.connected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                                    <CheckCircle2 className="size-3" /> Connected · {status.folderName}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">
                                    1-Min Setup Required
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted">
                            Saari videos aapke Google Drive folder me permanently store hoti hain (chat se delete karne par bhi safe).
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href={status.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm text-xs"
                    >
                        <ExternalLink className="size-3.5" /> Open Drive Folder
                    </a>
                    {status.connected ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="btn btn-outline btn-sm text-xs"
                        >
                            <Settings2 className="size-3.5" />
                            {expanded ? "Hide Setup" : "Settings"}
                        </button>
                    ) : null}
                </div>
            </div>

            {showSetup ? (
                <div className="mt-4 space-y-3 rounded-xl border border-line bg-bg p-3.5 text-xs">
                    <p className="font-semibold text-ink">
                        Google Drive connect karne ke 3 easy steps (sirf 1 baar karna hai):
                    </p>
                    <ol className="list-decimal space-y-1.5 pl-4 text-muted leading-relaxed">
                        <li>
                            Neeche <strong>Copy Google Drive Script</strong> button dabayein, fir{" "}
                            <a
                                href="https://script.google.com/home/start"
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-accent underline"
                            >
                                script.google.com
                            </a>{" "}
                            kholkar <strong>New project</strong> me purana code hata kar paste karein aur Save karein.
                        </li>
                        <li>
                            Upar right side <strong>Deploy → New deployment</strong> par click karein → Gear icon se{" "}
                            <strong>Web app</strong> chunein → <strong>Execute as: Me</strong> aur{" "}
                            <strong>Who has access: Anyone</strong> select karke <strong>Deploy</strong> &amp; Google permission Allow karein.
                        </li>
                        <li>
                            Jo <strong>Web app URL</strong> milega (`https://script.google.com/macros/s/.../exec`), use neeche paste karke{" "}
                            <strong>Save &amp; Connect</strong> daba dein.
                        </li>
                    </ol>

                    <div className="flex flex-wrap gap-2 pt-1">
                        <button
                            type="button"
                            onClick={copyAppsScript}
                            className="btn btn-outline btn-sm text-xs"
                        >
                            <Copy className="size-3.5" /> Copy Google Drive Script
                        </button>
                    </div>

                    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                        <input
                            type="url"
                            value={scriptUrlInput}
                            onChange={(e) => setScriptUrlInput(e.target.value)}
                            placeholder="https://script.google.com/macros/s/.../exec"
                            className="input h-9 flex-1 text-xs font-mono"
                        />
                        <button
                            type="button"
                            onClick={handleSaveAndConnect}
                            disabled={saving}
                            className="btn btn-primary btn-sm h-9 shrink-0"
                        >
                            {saving ? (
                                <>
                                    <Spinner className="size-3.5" /> Connecting…
                                </>
                            ) : (
                                "Save & Connect"
                            )}
                        </button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function AdminWorkspace({ onLock }) {
    const toast = useToast();
    const {
        users,
        usersById,
        chatThreads,
        voicePacks,
        videoPacks,
        videoDriveConfig,
        allImages,
        calls,
        vaultItems,
        totalTextMessages,
        loading,
        rulesNeedSync,
        reload
    } = useAdminData(true);

    const [activeTab, setActiveTab] = useState("overview");
    const [selectedChatId, setSelectedChatId] = useState("");
    const [userFilterUid, setUserFilterUid] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [imageFilter, setImageFilter] = useState("all");
    const [lightboxSrc, setLightboxSrc] = useState("");

    const onlineCount = useMemo(
        () => users.filter((u) => isOnline(u)).length,
        [users]
    );

    function userLabel(uid) {
        if (!uid) return "Unknown";
        const u = usersById.get(uid);
        return u?.displayName || uid.slice(0, 8);
    }

    function userMobile(uid) {
        if (!uid) return "";
        return usersById.get(uid)?.mobileNumber || "";
    }

    function userAvatar(uid) {
        if (!uid) return "";
        return usersById.get(uid)?.photoURL || "";
    }

    function matchesSearch(uidA, uidB = "", extraText = "") {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return true;
        const digits = needle.replace(/\D/g, "");
        const hay = [
            userLabel(uidA),
            userMobile(uidA),
            uidA,
            uidB ? userLabel(uidB) : "",
            uidB ? userMobile(uidB) : "",
            uidB,
            extraText
        ]
            .join(" ")
            .toLowerCase();
        if (hay.includes(needle)) return true;
        if (digits && (userMobile(uidA).includes(digits) || userMobile(uidB).includes(digits))) {
            return true;
        }
        return false;
    }

    function copyRules() {
        if (!navigator.clipboard?.writeText) {
            toast.error("Clipboard is not available in this browser.");
            return;
        }
        navigator.clipboard
            .writeText(firestoreRulesRaw)
            .then(() =>
                toast.success("Firestore rules copied! Paste & Publish in Firebase Console.")
            )
            .catch(() => toast.error("Could not copy rules."));
    }

    function exportBackupJson() {
        const payload = {
            exportedAt: new Date().toISOString(),
            summary: {
                users: users.length,
                chatThreads: chatThreads.length,
                messages: totalTextMessages,
                images: allImages.length,
                voicePacks: voicePacks.length,
                videoPacks: videoPacks.length,
                calls: calls.length,
                vaultRecords: vaultItems.length
            },
            users: users.map((u) => ({
                ...u,
                createdAt: serializeTimestamp(u.createdAt),
                updatedAt: serializeTimestamp(u.updatedAt),
                lastSeen: serializeTimestamp(u.lastSeen)
            })),
            chatThreads: chatThreads.map((t) => ({
                id: t.id,
                participants: t.participants,
                updatedAt: serializeTimestamp(t.updatedAt),
                messages: t.messages.map((m) => ({
                    ...m,
                    createdAt: serializeTimestamp(m.createdAt),
                    editedAt: serializeTimestamp(m.editedAt)
                }))
            })),
            voicePacks: voicePacks.map((v) => ({
                ...v,
                createdAt: serializeTimestamp(v.createdAt),
                editedAt: serializeTimestamp(v.editedAt)
            })),
            videoPacks: videoPacks.map((v) => ({
                ...v,
                createdAt: serializeTimestamp(v.createdAt),
                editedAt: serializeTimestamp(v.editedAt)
            })),
            calls: calls.map((c) => ({
                ...c,
                createdAt: serializeTimestamp(c.createdAt),
                updatedAt: serializeTimestamp(c.updatedAt),
                endedAt: serializeTimestamp(c.endedAt)
            }))
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-app2-admin-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast.success("Full backup JSON downloaded.");
    }

    const filteredUsers = useMemo(
        () =>
            users.filter((u) =>
                matchesSearch(u.uid, "", `${u.displayName || ""} ${u.bio || ""}`)
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [users, searchQuery, usersById]
    );

    const filteredThreads = useMemo(
        () =>
            chatThreads.filter((thread) => {
                const [a = "", b = ""] = thread.participants || thread.id.split("_");
                if (userFilterUid && a !== userFilterUid && b !== userFilterUid) {
                    return false;
                }
                const lastText = thread.lastMessage?.text || "";
                return matchesSearch(a, b, lastText);
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [chatThreads, userFilterUid, searchQuery, usersById]
    );

    const activeThread = useMemo(
        () =>
            chatThreads.find((t) => t.id === selectedChatId) ||
            filteredThreads[0] ||
            null,
        [chatThreads, selectedChatId, filteredThreads]
    );

    const filteredImages = useMemo(
        () =>
            allImages.filter((item) => {
                if (imageFilter !== "all" && item.source !== imageFilter) return false;
                if (
                    userFilterUid &&
                    item.senderId !== userFilterUid &&
                    item.receiverId !== userFilterUid
                ) {
                    return false;
                }
                return matchesSearch(item.senderId, item.receiverId, item.source);
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allImages, imageFilter, userFilterUid, searchQuery, usersById]
    );

    const filteredVoice = useMemo(
        () =>
            voicePacks.filter((item) => {
                if (
                    userFilterUid &&
                    item.senderId !== userFilterUid &&
                    item.receiverId !== userFilterUid
                ) {
                    return false;
                }
                return matchesSearch(item.senderId, item.receiverId);
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [voicePacks, userFilterUid, searchQuery, usersById]
    );

    const filteredVideos = useMemo(
        () =>
            videoPacks.filter((item) => {
                if (
                    userFilterUid &&
                    item.senderId !== userFilterUid &&
                    item.receiverId !== userFilterUid
                ) {
                    return false;
                }
                return matchesSearch(
                    item.senderId,
                    item.receiverId,
                    `${item.fileName || ""} ${item.text || ""}`
                );
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [videoPacks, userFilterUid, searchQuery, usersById]
    );

    const filteredCalls = useMemo(
        () =>
            calls.filter((call) => {
                if (
                    userFilterUid &&
                    call.callerId !== userFilterUid &&
                    call.calleeId !== userFilterUid
                ) {
                    return false;
                }
                return matchesSearch(call.callerId, call.calleeId, call.status || "");
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [calls, userFilterUid, searchQuery, usersById]
    );

    function openTabForUser(tabId, targetUid) {
        setUserFilterUid(targetUid);
        setSearchQuery("");
        setSelectedChatId("");
        setActiveTab(tabId);
    }

    return (
        <div className="min-h-[100dvh] bg-bg text-ink">
            {/* Top Header */}
            <header className="safe-top sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <BrandMark size={32} withName subtitle="Permanent Admin Vault" />
                        <span className="hidden items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success sm:inline-flex">
                            <span className="size-1.5 rounded-full bg-success" />
                            Live
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={exportBackupJson}
                            className="btn btn-outline btn-sm hidden sm:inline-flex"
                            title="Download full permanent JSON backup"
                        >
                            <Download className="size-3.5" /> Backup JSON
                        </button>
                        <button
                            type="button"
                            onClick={reload}
                            className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-accent"
                            aria-label="Refresh data"
                            title="Refresh"
                        >
                            <RefreshCw className="size-4" />
                        </button>
                        <ThemeToggle />
                        <button
                            type="button"
                            onClick={onLock}
                            className="btn btn-outline btn-sm text-danger hover:border-danger hover:text-danger"
                            title="Lock Admin Panel"
                        >
                            <Lock className="size-3.5" />
                            <span className="hidden sm:inline">Lock</span>
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="mx-auto max-w-6xl overflow-x-auto px-4 scrollbar-thin">
                    <nav className="flex items-center gap-1 pb-2" aria-label="Admin sections">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.id;
                            const count =
                                tab.id === "users"
                                    ? users.length
                                    : tab.id === "chats"
                                      ? chatThreads.length
                                      : tab.id === "images"
                                        ? allImages.length
                                        : tab.id === "voice"
                                          ? voicePacks.length
                                          : tab.id === "videos"
                                            ? videoPacks.length
                                            : tab.id === "calls"
                                              ? calls.length
                                              : null;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                                        active
                                            ? "bg-accent text-white"
                                            : "text-muted hover:bg-bg hover:text-ink"
                                    )}
                                >
                                    <Icon className="size-3.5" />
                                    <span>{tab.label}</span>
                                    {count !== null ? (
                                        <span
                                            className={cn(
                                                "rounded-full px-1.5 py-0.2 text-[10px]",
                                                active
                                                    ? "bg-white/20 text-white"
                                                    : "bg-bg text-muted"
                                            )}
                                        >
                                            {count}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-5 pb-16">
                {/* Rules warning banner if Firebase Console rules block cross-user reads */}
                {rulesNeedSync ? (
                    <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
                                <div>
                                    <h2 className="text-sm font-bold">
                                        Publish Updated Firestore Rules for Video Pack &amp; Admin Access
                                    </h2>
                                    <p className="mt-0.5 text-xs leading-relaxed text-muted">
                                        Firebase Console me naye Video Pack + Admin Vault rules publish karne ke liye neeche button se rules copy karein aur{" "}
                                        <strong>Firebase Console → Firestore Database → Rules</strong> me paste karke <strong>Publish</strong> daba dein.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={copyRules}
                                className="btn btn-primary btn-sm shrink-0"
                            >
                                <Copy className="size-3.5" /> Copy Firestore Rules
                            </button>
                        </div>
                    </div>
                ) : null}

                {/* Active user filter chip */}
                {userFilterUid &&
                activeTab !== "overview" &&
                activeTab !== "users" &&
                activeTab !== "telegram" ? (
                    <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs">
                        <span>
                            Showing records for{" "}
                            <strong className="text-accent">{userLabel(userFilterUid)}</strong>{" "}
                            ({userMobile(userFilterUid) || userFilterUid.slice(0, 8)})
                        </span>
                        <button
                            type="button"
                            onClick={() => setUserFilterUid("")}
                            className="font-semibold text-accent hover:underline"
                        >
                            Show all users
                        </button>
                    </div>
                ) : null}

                {/* Google Drive setup & status card on Videos tab */}
                {!loading && activeTab === "videos" ? (
                    <GoogleDriveSetupCard savedScriptUrl={videoDriveConfig?.scriptUrl || ""} />
                ) : null}

                {/* Shared search bar for list tabs */}
                {activeTab !== "overview" && activeTab !== "telegram" ? (
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="w-full sm:max-w-md">
                            <SearchBar
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Search by user name, mobile number, or filename…"
                            />
                        </div>
                        {activeTab === "images" ? (
                            <div className="flex items-center gap-1">
                                {[
                                    { id: "all", label: "All Photos" },
                                    { id: "chat", label: "Chat Photos" },
                                    { id: "profile", label: "Profile Photos" }
                                ].map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setImageFilter(f.id)}
                                        className={cn(
                                            "rounded-full px-3 py-1 text-xs font-semibold",
                                            imageFilter === f.id
                                                ? "bg-accent text-white"
                                                : "border border-line bg-card text-muted hover:text-ink"
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
                        <Spinner className="size-5 text-accent" /> Loading permanent Admin data…
                    </div>
                ) : null}

                {/* ==================== OVERVIEW TAB ==================== */}
                {!loading && activeTab === "overview" ? (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                            <StatCard
                                icon={Users}
                                label="Users"
                                value={users.length}
                                sub={`${onlineCount} online now`}
                                onClick={() => setActiveTab("users")}
                            />
                            <StatCard
                                icon={MessageSquare}
                                label="Text Chats"
                                value={chatThreads.length}
                                sub={`${totalTextMessages} messages`}
                                onClick={() => setActiveTab("chats")}
                            />
                            <StatCard
                                icon={ImageIcon}
                                label="Photos"
                                value={allImages.length}
                                sub="Chat & profile"
                                onClick={() => setActiveTab("images")}
                            />
                            <StatCard
                                icon={Mic}
                                label="Voice Packs"
                                value={voicePacks.length}
                                sub="Playable anytime"
                                onClick={() => setActiveTab("voice")}
                            />
                            <StatCard
                                icon={Film}
                                label="Videos"
                                value={videoPacks.length}
                                sub="Google Drive 200 MB"
                                onClick={() => setActiveTab("videos")}
                            />
                            <StatCard
                                icon={PhoneCall}
                                label="Call Logs"
                                value={calls.length}
                                sub="Voice & video"
                                onClick={() => setActiveTab("calls")}
                            />
                            <StatCard
                                icon={Database}
                                label="Vault Archive"
                                value={vaultItems.length}
                                sub="Anti-delete"
                            />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            {/* Permanent Vault & Backup Card */}
                            <section className="panel p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                                            <ShieldCheck className="size-5" />
                                        </span>
                                        <div>
                                            <h2 className="text-sm font-bold">
                                                Permanent Data &amp; Google Drive Vault
                                            </h2>
                                            <p className="text-xs text-muted">
                                                Photos, messages, voice packs &amp; 200 MB Google Drive videos stay permanently preserved.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={exportBackupJson}
                                        className="btn btn-primary btn-sm"
                                    >
                                        <Download className="size-3.5" /> Export Full Backup (JSON)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={copyRules}
                                        className="btn btn-outline btn-sm"
                                    >
                                        <Copy className="size-3.5" /> Copy Firestore Rules
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("videos")}
                                        className="btn btn-outline btn-sm"
                                    >
                                        <Cloud className="size-3.5" /> Drive Video Setup
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("telegram")}
                                        className="btn btn-outline btn-sm"
                                    >
                                        <Send className="size-3.5" /> Telegram Alert Setup
                                    </button>
                                </div>

                                <div className="mt-3 flex items-center gap-2 text-xs">
                                    {rulesNeedSync ? (
                                        <span className="inline-flex items-center gap-1.5 text-warn">
                                            <ShieldAlert className="size-4" />
                                            Rules update needed in Firebase Console for cross-user &amp; Video Pack access
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-success">
                                            <CheckCircle2 className="size-4" />
                                            Connected to Firebase Firestore in real time
                                        </span>
                                    )}
                                </div>
                            </section>

                            {/* Latest Images Quick Preview */}
                            <section className="panel p-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-bold">Recent Photos</h2>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("images")}
                                        className="text-xs font-semibold text-accent hover:underline"
                                    >
                                        View all ({allImages.length})
                                    </button>
                                </div>
                                {allImages.length === 0 ? (
                                    <p className="mt-4 text-xs text-muted">
                                        No photos stored yet.
                                    </p>
                                ) : (
                                    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                                        {allImages.slice(0, 6).map((img) => (
                                            <button
                                                key={img.id}
                                                type="button"
                                                onClick={() => setLightboxSrc(img.url)}
                                                className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-bg"
                                            >
                                                <img
                                                    src={img.url}
                                                    alt=""
                                                    className="size-full object-cover transition-transform group-hover:scale-105"
                                                    loading="lazy"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Recent Videos Preview */}
                        <section className="panel p-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold">Recent Video Packs</h2>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("videos")}
                                    className="text-xs font-semibold text-accent hover:underline"
                                >
                                    View all ({videoPacks.length})
                                </button>
                            </div>
                            {videoPacks.length === 0 ? (
                                <p className="mt-3 text-xs text-muted">
                                    No videos shared yet.
                                </p>
                            ) : (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {videoPacks.slice(0, 3).map((vid) => (
                                        <div
                                            key={`${vid.chatId}_${vid.id}`}
                                            className="rounded-xl border border-line bg-bg p-3"
                                        >
                                            <p className="mb-1.5 truncate text-xs font-bold">
                                                {userLabel(vid.senderId)} → {userLabel(vid.receiverId)}
                                            </p>
                                            <VideoPlayerCard
                                                src={vid.videoUrl}
                                                poster={vid.posterUrl}
                                                fileName={vid.fileName}
                                                fileSize={vid.fileSize}
                                                duration={vid.duration}
                                                className="w-full sm:w-full"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Recent Voice Packs Preview */}
                        <section className="panel p-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold">Recent Voice Packs</h2>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("voice")}
                                    className="text-xs font-semibold text-accent hover:underline"
                                >
                                    View all ({voicePacks.length})
                                </button>
                            </div>
                            {voicePacks.length === 0 ? (
                                <p className="mt-3 text-xs text-muted">
                                    No voice packs stored yet.
                                </p>
                            ) : (
                                <div className="mt-3 divide-y divide-line">
                                    {voicePacks.slice(0, 4).map((vp) => (
                                        <div
                                            key={`${vp.chatId}_${vp.id}`}
                                            className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold">
                                                    {userLabel(vp.senderId)} →{" "}
                                                    {userLabel(vp.receiverId)}
                                                </p>
                                                <p className="text-[11px] text-muted">
                                                    {formatDateTime(vp.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <VoicePlayer
                                                    src={vp.audioUrl}
                                                    duration={vp.duration}
                                                />
                                                {vp.audioUrl ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            triggerMediaDownload(
                                                                vp.audioUrl,
                                                                `voice-${vp.id}`
                                                            )
                                                        }
                                                        className="flex size-8 items-center justify-center rounded-full border border-line text-muted hover:border-accent hover:text-accent"
                                                        title="Download audio"
                                                    >
                                                        <Download className="size-3.5" />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                ) : null}

                {/* ==================== USERS TAB ==================== */}
                {!loading && activeTab === "users" ? (
                    filteredUsers.length === 0 ? (
                        <EmptyBox label="No matching users found." />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredUsers.map((user) => {
                                const online = isOnline(user);
                                return (
                                    <div
                                        key={user.uid}
                                        className="panel flex flex-col justify-between p-4"
                                    >
                                        <div>
                                            <div className="flex items-start gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        user.photoURL && setLightboxSrc(user.photoURL)
                                                    }
                                                    className="shrink-0"
                                                    title={
                                                        user.photoURL
                                                            ? "Click to enlarge photo"
                                                            : undefined
                                                    }
                                                >
                                                    <Avatar
                                                        name={user.displayName}
                                                        src={user.photoURL}
                                                        uid={user.uid}
                                                        size="md"
                                                        online={online}
                                                    />
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="truncate text-sm font-bold">
                                                            {user.displayName || "Unnamed"}
                                                        </h3>
                                                        {online ? (
                                                            <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                                                                Online
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                                                        <Phone className="size-3" />
                                                        {user.mobileNumber || "No number"}
                                                    </p>
                                                    {user.bio ? (
                                                        <p className="mt-1.5 line-clamp-2 text-xs text-ink/85">
                                                            {user.bio}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="mt-3 space-y-1 border-t border-line pt-2.5 text-[11px] text-muted">
                                                <p>
                                                    <strong>Last seen:</strong>{" "}
                                                    {formatDateTime(user.lastSeen)}
                                                </p>
                                                <p>
                                                    <strong>Joined:</strong>{" "}
                                                    {formatDateTime(user.createdAt)}
                                                </p>
                                                <p className="flex items-center justify-between gap-2">
                                                    <span className="truncate font-mono text-[10px]">
                                                        UID: {user.uid}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard
                                                                ?.writeText(user.uid)
                                                                .then(() =>
                                                                    toast.success("UID copied.")
                                                                );
                                                        }}
                                                        className="text-accent hover:underline"
                                                    >
                                                        Copy
                                                    </button>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => openTabForUser("chats", user.uid)}
                                                className="btn btn-outline btn-sm px-2 text-xs"
                                            >
                                                <MessageSquare className="size-3.5" /> Chats
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openTabForUser("voice", user.uid)}
                                                className="btn btn-outline btn-sm px-2 text-xs"
                                            >
                                                <Mic className="size-3.5" /> Voice
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openTabForUser("videos", user.uid)}
                                                className="btn btn-outline btn-sm px-2 text-xs"
                                            >
                                                <Film className="size-3.5" /> Videos
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : null}

                {/* ==================== CHATS TAB ==================== */}
                {!loading && activeTab === "chats" ? (
                    filteredThreads.length === 0 ? (
                        <EmptyBox label="No conversations found." />
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                            {/* Thread List */}
                            <div
                                className={cn(
                                    "panel max-h-[75dvh] divide-y divide-line overflow-y-auto scrollbar-thin",
                                    selectedChatId ? "hidden lg:block" : "block"
                                )}
                            >
                                {filteredThreads.map((thread) => {
                                    const [a = "", b = ""] =
                                        thread.participants || thread.id.split("_");
                                    const selected = activeThread?.id === thread.id;
                                    const imgCount = thread.messages.filter(
                                        (m) => m.type === "image" && m.imageUrl
                                    ).length;
                                    const lastMsg =
                                        thread.messages[thread.messages.length - 1];

                                    return (
                                        <button
                                            key={thread.id}
                                            type="button"
                                            onClick={() => setSelectedChatId(thread.id)}
                                            className={cn(
                                                "flex w-full flex-col gap-1 px-3.5 py-3 text-left transition-colors",
                                                selected
                                                    ? "bg-accent-soft"
                                                    : "hover:bg-bg"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-xs font-bold">
                                                    {userLabel(a)} ↔ {userLabel(b)}
                                                </p>
                                                <span className="shrink-0 text-[10px] text-muted">
                                                    {thread.messages.length} msgs
                                                    {imgCount ? ` · ${imgCount} img` : ""}
                                                </span>
                                            </div>
                                            <p className="truncate text-xs text-muted">
                                                {lastMsg
                                                    ? lastMsg.type === "image"
                                                        ? "📷 Photo"
                                                        : lastMsg.text || "Message"
                                                    : thread.lastMessage?.text || "No messages"}
                                            </p>
                                            <p className="text-[10px] text-muted">
                                                {formatDateTime(
                                                    lastMsg?.createdAt || thread.updatedAt
                                                )}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Thread Messages Viewer */}
                            {activeThread ? (
                                <div className="panel flex max-h-[75dvh] flex-col overflow-hidden">
                                    <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedChatId("")}
                                                className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-bg lg:hidden"
                                                aria-label="Back to thread list"
                                            >
                                                <ArrowLeft className="size-4" />
                                            </button>
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-bold">
                                                    {(
                                                        activeThread.participants ||
                                                        activeThread.id.split("_")
                                                    )
                                                        .map(
                                                            (id) =>
                                                                `${userLabel(id)} (${userMobile(id) || id.slice(0, 6)})`
                                                        )
                                                        .join("  ↔  ")}
                                                </h3>
                                                <p className="text-[11px] text-muted">
                                                    {activeThread.messages.length} stored messages
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
                                        {activeThread.messages.length === 0 ? (
                                            <p className="py-10 text-center text-xs text-muted">
                                                No messages in this conversation yet.
                                            </p>
                                        ) : (
                                            activeThread.messages.map((msg) => {
                                                const reactions = Object.entries(
                                                    msg.reactions || {}
                                                );
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className="rounded-xl border border-line bg-bg/60 p-3"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <Avatar
                                                                    name={userLabel(msg.senderId)}
                                                                    src={userAvatar(msg.senderId)}
                                                                    uid={msg.senderId}
                                                                    size="xs"
                                                                />
                                                                <span className="text-xs font-bold">
                                                                    {userLabel(msg.senderId)}
                                                                </span>
                                                                {userMobile(msg.senderId) ? (
                                                                    <span className="text-[11px] text-muted">
                                                                        ({userMobile(msg.senderId)})
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[11px] text-muted">
                                                                {msg.deletedForEveryone ? (
                                                                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
                                                                        {msg.preservedFromVault
                                                                            ? "Deleted in chat · Restored from Vault"
                                                                            : "Deleted in chat"}
                                                                    </span>
                                                                ) : null}
                                                                {msg.editedAt ? (
                                                                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                                                                        Edited
                                                                    </span>
                                                                ) : null}
                                                                <span>
                                                                    {formatDateTime(msg.createdAt)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {msg.replyTo ? (
                                                            <div className="mt-2 rounded border-l-2 border-accent bg-card px-2.5 py-1 text-xs text-muted">
                                                                Reply to{" "}
                                                                <strong>
                                                                    {userLabel(msg.replyTo.senderId)}
                                                                </strong>
                                                                : {msg.replyTo.text || msg.replyTo.type}
                                                            </div>
                                                        ) : null}

                                                        {msg.type === "image" && msg.imageUrl ? (
                                                            <div className="mt-2.5 flex items-start gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setLightboxSrc(msg.imageUrl)
                                                                    }
                                                                    className="overflow-hidden rounded-lg border border-line"
                                                                >
                                                                    <img
                                                                        src={msg.imageUrl}
                                                                        alt="Chat attachment"
                                                                        className="max-h-60 w-auto object-contain"
                                                                        loading="lazy"
                                                                    />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        triggerMediaDownload(
                                                                            msg.imageUrl,
                                                                            `chat-image-${msg.id}`
                                                                        )
                                                                    }
                                                                    className="flex size-8 items-center justify-center rounded-full border border-line bg-card text-muted hover:border-accent hover:text-accent"
                                                                    title="Download photo"
                                                                >
                                                                    <Download className="size-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : null}

                                                        {msg.text ? (
                                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                                                                {msg.text}
                                                            </p>
                                                        ) : !msg.imageUrl ? (
                                                            <p className="mt-2 text-xs italic text-muted">
                                                                (No content stored prior to Vault)
                                                            </p>
                                                        ) : null}

                                                        {msg.originalText ? (
                                                            <p className="mt-1 text-xs text-muted">
                                                                <strong>Original before edit:</strong>{" "}
                                                                {msg.originalText}
                                                            </p>
                                                        ) : null}

                                                        {reactions.length > 0 ? (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {reactions.map(([rUid, emoji]) => (
                                                                    <span
                                                                        key={rUid}
                                                                        className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px]"
                                                                    >
                                                                        {emoji} {userLabel(rUid)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )
                ) : null}

                {/* ==================== IMAGES TAB ==================== */}
                {!loading && activeTab === "images" ? (
                    filteredImages.length === 0 ? (
                        <EmptyBox label="No stored images found." />
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {filteredImages.map((img) => (
                                <div
                                    key={img.id}
                                    className="panel flex flex-col overflow-hidden"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setLightboxSrc(img.url)}
                                        className="group relative aspect-square w-full overflow-hidden bg-bg"
                                    >
                                        <img
                                            src={img.url}
                                            alt=""
                                            className="size-full object-cover transition-transform group-hover:scale-105"
                                            loading="lazy"
                                        />
                                        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                                            {img.source === "profile" ? "Profile" : "Chat"}
                                        </span>
                                        {img.preservedFromVault ? (
                                            <span className="absolute right-2 top-2 rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-white">
                                                Vaulted
                                            </span>
                                        ) : null}
                                    </button>
                                    <div className="flex flex-1 items-center justify-between gap-2 p-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-bold">
                                                {img.source === "profile"
                                                    ? userLabel(img.senderId)
                                                    : `${userLabel(img.senderId)} → ${userLabel(img.receiverId)}`}
                                            </p>
                                            <p className="truncate text-[10px] text-muted">
                                                {formatDateTime(img.createdAt)}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                triggerMediaDownload(img.url, img.id)
                                            }
                                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:border-accent hover:text-accent"
                                            title="Download photo"
                                        >
                                            <Download className="size-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : null}

                {/* ==================== VOICE PACKS TAB ==================== */}
                {!loading && activeTab === "voice" ? (
                    filteredVoice.length === 0 ? (
                        <EmptyBox label="No Voice Pack recordings found." />
                    ) : (
                        <div className="space-y-2.5">
                            {filteredVoice.map((vp) => (
                                <div
                                    key={`${vp.chatId}_${vp.id}`}
                                    className="panel flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Avatar
                                            name={userLabel(vp.senderId)}
                                            src={userAvatar(vp.senderId)}
                                            uid={vp.senderId}
                                            size="sm"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <p className="truncate text-sm font-bold">
                                                    {userLabel(vp.senderId)} →{" "}
                                                    {userLabel(vp.receiverId)}
                                                </p>
                                                {vp.preservedFromVault ? (
                                                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
                                                        Deleted in chat · Restored
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="text-xs text-muted">
                                                {formatDateTime(vp.createdAt)} · Duration{" "}
                                                {formatClock(vp.duration || 0)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {vp.audioUrl ? (
                                            <>
                                                <VoicePlayer
                                                    src={vp.audioUrl}
                                                    duration={vp.duration}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        triggerMediaDownload(
                                                            vp.audioUrl,
                                                            `voice-pack-${vp.id}`
                                                        )
                                                    }
                                                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:border-accent hover:text-accent"
                                                    title="Download voice pack"
                                                >
                                                    <Download className="size-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs italic text-muted">
                                                Audio deleted before Vault activation
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : null}

                {/* ==================== VIDEOS TAB ==================== */}
                {!loading && activeTab === "videos" ? (
                    filteredVideos.length === 0 ? (
                        <EmptyBox label="No Video Pack uploads found yet." />
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredVideos.map((vid) => {
                                const dlUrl = resolveVideoStreamUrl(vid.videoUrl, {
                                    download: true,
                                    fileName: vid.fileName || `video-${vid.id}.mp4`
                                });
                                return (
                                    <div
                                        key={`${vid.chatId}_${vid.id}`}
                                        className="panel flex flex-col justify-between p-3.5"
                                    >
                                        <div>
                                            <div className="mb-2.5 flex items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <Avatar
                                                        name={userLabel(vid.senderId)}
                                                        src={userAvatar(vid.senderId)}
                                                        uid={vid.senderId}
                                                        size="xs"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="truncate text-xs font-bold">
                                                            {userLabel(vid.senderId)} →{" "}
                                                            {userLabel(vid.receiverId)}
                                                        </p>
                                                        <p className="text-[10px] text-muted">
                                                            {formatDateTime(vid.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {vid.preservedFromVault ? (
                                                    <span className="shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
                                                        Vault Restored
                                                    </span>
                                                ) : null}
                                            </div>

                                            <VideoPlayerCard
                                                src={vid.videoUrl}
                                                poster={vid.posterUrl}
                                                fileName={vid.fileName}
                                                fileSize={vid.fileSize}
                                                duration={vid.duration}
                                                className="w-full sm:w-full"
                                            />

                                            {vid.text ? (
                                                <p className="mt-2 whitespace-pre-wrap break-words text-xs text-ink/90">
                                                    {vid.text}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[11px] text-muted">
                                            <span className="truncate">
                                                {vid.fileSize > 0
                                                    ? formatBytes(vid.fileSize)
                                                    : "Google Drive"}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {vid.driveFileId ? (
                                                    <a
                                                        href={`https://drive.google.com/file/d/${vid.driveFileId}/view`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="btn btn-outline btn-sm h-7 px-2 text-[11px]"
                                                        title="Open file in Google Drive"
                                                    >
                                                        <ExternalLink className="size-3" /> Drive
                                                    </a>
                                                ) : null}
                                                {dlUrl ? (
                                                    <a
                                                        href={dlUrl}
                                                        download={vid.fileName || "video.mp4"}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="btn btn-primary btn-sm h-7 px-2.5 text-[11px]"
                                                    >
                                                        <Download className="size-3" /> Download
                                                    </a>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : null}

                {/* ==================== CALLS TAB ==================== */}
                {!loading && activeTab === "calls" ? (
                    filteredCalls.length === 0 ? (
                        <EmptyBox label="No voice or video calls logged yet." />
                    ) : (
                        <div className="panel divide-y divide-line overflow-hidden">
                            {filteredCalls.map((call) => {
                                const isVideo = call.type === "video";
                                return (
                                    <div
                                        key={call.id}
                                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                                                {isVideo ? (
                                                    <Video className="size-4" />
                                                ) : (
                                                    <Phone className="size-4" />
                                                )}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold">
                                                    {userLabel(call.callerId)} →{" "}
                                                    {userLabel(call.calleeId)}
                                                </p>
                                                <p className="text-xs text-muted">
                                                    {isVideo ? "Video call" : "Voice call"} ·{" "}
                                                    {formatDateTime(call.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className={cn(
                                                "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                                                call.status === "connected" ||
                                                    call.status === "ended"
                                                    ? "bg-success/15 text-success"
                                                    : call.status === "missed" ||
                                                        call.status === "declined" ||
                                                        call.status === "failed"
                                                      ? "bg-danger/15 text-danger"
                                                      : "bg-accent-soft text-accent"
                                            )}
                                        >
                                            {call.status || "unknown"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : null}

                {/* ==================== TELEGRAM ALERT TAB ==================== */}
                {!loading && activeTab === "telegram" ? (
                    <TelegramAlertPanel onCopyRules={copyRules} />
                ) : null}
            </main>

            <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc("")} />
        </div>
    );
}

function StatCard({ icon: Icon, label, value, sub, onClick }) {
    const Tag = onClick ? "button" : "div";
    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={cn(
                "panel flex flex-col items-start p-3.5 text-left transition-colors",
                onClick ? "hover:border-accent" : ""
            )}
        >
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon className="size-4" />
            </span>
            <p className="mt-2.5 text-2xl font-bold leading-none tabular-nums">{value}</p>
            <p className="mt-1 text-xs font-semibold">{label}</p>
            {sub ? <p className="mt-0.5 text-[11px] text-muted">{sub}</p> : null}
        </Tag>
    );
}

function EmptyBox({ label }) {
    return (
        <div className="panel py-12 text-center text-sm text-muted">
            {label}
        </div>
    );
}

export default function AdminApp() {
    const [unlocked, setUnlocked] = useState(false);

    useEffect(() => {
        document.title = "Admin Vault — Personal Chat";
        function handlePageShow(event) {
            if (event.persisted) setUnlocked(false);
        }
        window.addEventListener("pageshow", handlePageShow);
        return () => window.removeEventListener("pageshow", handlePageShow);
    }, []);

    async function handleLock() {
        setUnlocked(false);
        await signOutAdmin();
    }

    return (
        <ThemeProvider>
            <ToastProvider>
                {!isFirebaseConfigured ? (
                    <SetupPage />
                ) : !unlocked ? (
                    <AdminLoginPage onAuthenticated={() => setUnlocked(true)} />
                ) : (
                    <AdminWorkspace onLock={handleLock} />
                )}
            </ToastProvider>
        </ThemeProvider>
    );
}
