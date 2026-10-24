import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export function ThemeToggle({ className = "" }) {
    const { theme, toggleTheme } = useTheme();
    const dark = theme === "dark";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`flex size-9 items-center justify-center rounded-md border border-line bg-card text-ink transition-colors hover:border-accent hover:text-accent ${className}`}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            title={dark ? "Light theme" : "Dark theme"}
        >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
    );
}
