import { useMemo, useState } from "react";
import { SearchX, UsersRound } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { ThemeToggle } from "../components/ThemeToggle";
import { SearchBar } from "../components/SearchBar";
import { UserRow } from "../components/UserRow";
import { ListSkeleton } from "../components/LoadingScreen";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useAuth } from "../context/AuthContext";
import { useDirectory } from "../hooks/useDirectory";
import { chatService } from "../services/chatService";

export default function HomePage() {
    const { uid, profile } = useAuth();
    const { users, loading, error, reload } = useDirectory(chatService, uid);
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
            <AppHeader
                brand
                subtitle={profile?.displayName ? `Hi, ${profile.displayName}` : "Your conversations"}
                actions={<ThemeToggle />}
            />

            <div className="px-4 pb-2 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                    <h1 className="text-xl font-bold tracking-tight">Messages</h1>
                    {!loading && !error ? (
                        <span className="text-2xs font-medium text-muted">
                            {users.length} {users.length === 1 ? "person" : "people"}
                        </span>
                    ) : null}
                </div>
                <div className="mt-3">
                    <SearchBar
                        value={query}
                        onChange={setQuery}
                        placeholder="Search by name or mobile number"
                    />
                </div>
            </div>

            {loading ? (
                <ListSkeleton rows={7} />
            ) : error ? (
                <ErrorState
                    title="Could not load chats"
                    message={error}
                    onRetry={reload}
                />
            ) : users.length === 0 ? (
                <EmptyState
                    icon={UsersRound}
                    title="No other users yet"
                    description="When another person registers, they will appear here and you can start a private chat."
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
                            to={`/chat/${user.uid}`}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
