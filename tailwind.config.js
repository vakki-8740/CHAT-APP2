/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["selector", '[data-theme="dark"]'],
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                bg: "rgb(var(--bg-rgb) / <alpha-value>)",
                card: "rgb(var(--card-rgb) / <alpha-value>)",
                ink: "rgb(var(--text-rgb) / <alpha-value>)",
                muted: "rgb(var(--muted-rgb) / <alpha-value>)",
                line: "rgb(var(--border-rgb) / <alpha-value>)",
                accent: {
                    DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
                    soft: "var(--accent-soft)"
                },
                success: "rgb(var(--yes-rgb) / <alpha-value>)",
                danger: "rgb(var(--no-rgb) / <alpha-value>)",
                warn: "rgb(var(--warn-rgb) / <alpha-value>)"
            },
            borderRadius: {
                DEFAULT: "6px",
                md: "6px",
                lg: "10px",
                xl: "14px"
            },
            fontSize: {
                "2xs": "0.6875rem",
                xs: "0.75rem",
                sm: "0.875rem",
                base: "0.9375rem"
            },
            boxShadow: {
                card: "var(--shadow)",
                sheet: "0 -8px 30px rgba(0,0,0,0.18)"
            },
            fontFamily: {
                sans: [
                    "system-ui",
                    "-apple-system",
                    "Segoe UI",
                    "Roboto",
                    "sans-serif"
                ]
            }
        }
    },
    plugins: []
};
