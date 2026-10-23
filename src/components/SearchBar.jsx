import { Search, X } from "lucide-react";

export function SearchBar({ value, onChange, placeholder = "Search users" }) {
    return (
        <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="input h-10 pl-9 pr-9 text-sm"
                aria-label={placeholder}
            />
            {value ? (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
                    aria-label="Clear search"
                >
                    <X className="size-3.5" />
                </button>
            ) : null}
        </div>
    );
}
