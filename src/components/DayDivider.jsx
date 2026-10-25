import { formatDayLabel } from "../utils/format";

export function DayDivider({ value }) {
    const label = formatDayLabel(value);
    if (!label) return null;

    return (
        <div className="my-4 flex items-center gap-3" role="separator" aria-label={label}>
            <span className="h-px flex-1 bg-line" />
            <span className="rounded-full border border-line bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted shadow-sm">
                {label}
            </span>
            <span className="h-px flex-1 bg-line" />
        </div>
    );
}
