import { UsersRound } from "lucide-react";

export function EmptyState({ icon: Icon = UsersRound, title, description, action, compact = false }) {
    return (
        <div
            className={`flex flex-col items-center justify-center text-center ${
                compact ? "px-4 py-10" : "px-6 py-16"
            }`}
        >
            <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Icon className="size-7" strokeWidth={1.8} />
            </span>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description ? (
                <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">{description}</p>
            ) : null}
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}
