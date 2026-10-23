import { NavLink } from "react-router-dom";
import { Mic, MessageSquareText, UserRound } from "lucide-react";
import { isStorageConfigured } from "../config/env";
import { cn } from "../utils/cn";

const ITEMS = [
    { to: "/", label: "Chats", icon: MessageSquareText, end: true },
    { to: "/voice", label: "Voice", icon: Mic, end: false },
    { to: "/profile", label: "Profile", icon: UserRound, end: false }
];

export function BottomNav() {
    const items = isStorageConfigured
        ? ITEMS
        : ITEMS.filter((item) => item.to !== "/voice");

    return (
        <nav
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur"
            aria-label="Main navigation"
        >
            <div className="mx-auto flex w-full max-w-[760px] items-stretch">
                {items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            cn(
                                "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors",
                                isActive ? "text-accent" : "text-muted hover:text-ink"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon
                                    className={cn("size-[22px]", isActive && "stroke-[2.2]")}
                                    strokeWidth={1.8}
                                />
                                <span>{label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
