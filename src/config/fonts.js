export const DEFAULT_FONT_ID = "inter";

export const APP_FONTS = [
    {
        id: "inter",
        name: "Inter",
        style: "Modern",
        family: '"Inter Variable", "Noto Sans Devanagari", system-ui, sans-serif'
    },
    {
        id: "manrope",
        name: "Manrope",
        style: "Polished",
        family: '"Manrope Variable", "Noto Sans Devanagari", system-ui, sans-serif'
    },
    {
        id: "dm-sans",
        name: "DM Sans",
        style: "Balanced",
        family: '"DM Sans Variable", "Noto Sans Devanagari", system-ui, sans-serif'
    },
    {
        id: "lora",
        name: "Lora",
        style: "Editorial serif",
        family: '"Lora Variable", "Noto Sans Devanagari", Georgia, serif'
    },
    {
        id: "source-serif-4",
        name: "Source Serif 4",
        style: "Refined serif",
        family: '"Source Serif 4 Variable", "Noto Sans Devanagari", Georgia, serif'
    }
];

export function getAppFont(fontId) {
    return APP_FONTS.find((font) => font.id === fontId) || APP_FONTS[0];
}
