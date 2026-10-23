import { useMemo, useState } from "react";
import { Mic, SearchX } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { ThemeToggle } from "../components/ThemeToggle";
import { SearchBar } from "../components/SearchBar";
import { UserRow } from "../components/UserRow";
import { ListSkeleton } from "../components/LoadingScreen";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useAuth } from "../context/AuthContext";
import { useDirectory } from "../hooks/useDirectory";
import { voiceService } from "../services/voiceService";

export default function VoicePackPage() {
    const { uid } = useAuth();
    const { users, loading, error, reload } = useDirectory(voiceService, uid);
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return users;
        return users.filter((user) => {
            const name = String(user.displayName || "").toLowerCase();
            const mobile = String(user.mobileNumber || "");
            const digits = needle.replace(/\D/g, "");
            return name.includes(needle) || (digits.length > 0 && mobile.includes(digits));
        });
    }, [users, query]);

    return (
        <>
            <AppHeader brand subtitle="Voice notes · separate from chats" actions={<ThemeToggle />} />

            <div className="px-4 pb-2 pt-4">
                <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <Mic className="size-4" />
                    </span>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Voice Pack</h1>
                    </div>
                </div>
                <div className="mt-3">
                    <SearchBar
                        value={query}
                        onChange={setQuery}
                        placeholder="Search people for voice notes"
                    />
                </div>
            </div>

            {loading ? (
                <ListSkeleton rows={7} />
            ) : error ? (
                <ErrorState title="Could not load Voice Pack" message={error} onRetry={reload} />
            ) : users.length === 0 ? (
                <EmptyState
                    icon={Mic}
                    title="No one to talk to yet"
                    description="Voice Pack lists every registered user. As soon as someone joins, you can send them a voice note."
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={SearchX}
                    title="No users found"
                    description="Try a different name or mobile number."
                    action={
                        <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setQuery("")}
                        >
                            Clear search
                        </button>
                    }
                />
            ) : (
                <div className="mt-1 divide-y divide-line border-y border-line bg-card">
                    {filtered.map((user) => (
                        <UserRow
                            key={user.uid}
                            user={user}
                            currentUid={uid}
                            to={`/voice/${user.uid}`}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
