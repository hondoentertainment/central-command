export const ICON_OPTIONS = [
  { value: "auto", label: "Auto detect" },
  { value: "gmail", label: "Gmail" },
  { value: "slack", label: "Slack" },
  { value: "telegram", label: "Telegram" },
  { value: "calendar", label: "Calendar" },
  { value: "notion", label: "Notion" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "manus", label: "Manus" },
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
  { value: "supabase", label: "Supabase" },
  { value: "espn", label: "ESPN" },
  { value: "evernote", label: "Evernote" },
  { value: "zoom", label: "Zoom" },
  { value: "grok", label: "Grok" },
  { value: "dreamer", label: "Dreamer" },
  { value: "viktor", label: "Viktor" },
  { value: "openclaw", label: "OpenClaw" },
  { value: "kilocode", label: "Kilo Code" },
  { value: "generic", label: "Generic" },
];

export const appIcons = {
  gmail: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="#F3F6FB"/>
      <path d="M5 8.2 12 13l7-4.8" stroke="#EA4335" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 18V8.4" stroke="#34A853" stroke-width="2" stroke-linecap="round"/>
      <path d="M19 18V8.4" stroke="#4285F4" stroke-width="2" stroke-linecap="round"/>
      <path d="M5 8.5 12 14l7-5.5" stroke="#FBBC05" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    </svg>`,
  slack: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10.5" y="2" width="3" height="8" rx="1.5" fill="#36C5F0"/>
      <rect x="10.5" y="14" width="3" height="8" rx="1.5" fill="#2EB67D"/>
      <rect x="2" y="10.5" width="8" height="3" rx="1.5" fill="#E01E5A"/>
      <rect x="14" y="10.5" width="8" height="3" rx="1.5" fill="#ECB22E"/>
      <rect x="6.5" y="6.5" width="3" height="8" rx="1.5" fill="#36C5F0"/>
      <rect x="14.5" y="6.5" width="3" height="8" rx="1.5" fill="#E01E5A"/>
      <rect x="6.5" y="14.5" width="8" height="3" rx="1.5" fill="#2EB67D"/>
      <rect x="9.5" y="6.5" width="8" height="3" rx="1.5" fill="#ECB22E"/>
    </svg>`,
  telegram: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#27A7E7"/>
      <path d="m7 11.8 9.6-3.8c.45-.17.84.11.69.81l-1.64 7.73c-.12.55-.46.68-.94.42l-2.67-1.97-1.29 1.24c-.14.14-.26.26-.54.26l.19-2.73 4.97-4.49c.22-.19-.05-.3-.34-.11l-6.15 3.87-2.65-.83c-.58-.18-.59-.58.12-.86Z" fill="#fff"/>
    </svg>`,
  calendar: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="16" rx="3" fill="#4285F4"/>
      <path d="M3 9h18" stroke="#DCE7FF" stroke-width="2"/>
      <path d="M8 3v4M16 3v4" stroke="#DCE7FF" stroke-width="2" stroke-linecap="round"/>
      <rect x="7.5" y="11.5" width="3" height="3" rx="1" fill="#fff"/>
      <rect x="13.5" y="11.5" width="3" height="3" rx="1" fill="#fff" opacity=".9"/>
      <rect x="7.5" y="16" width="3" height="3" rx="1" fill="#fff" opacity=".9"/>
    </svg>`,
  notion: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" rx="2" fill="#fff"/>
      <path d="M8 17V8.2l1.2-.15 5.6 7V7h1.9v8.7l-1.1.3-5.7-7.1V17H8Z" fill="#111"/>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="#111" stroke-width="1.6"/>
    </svg>`,
  chatgpt: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#10A37F"/>
      <path d="M12 6.1a3.3 3.3 0 0 1 2.86 1.65 3.23 3.23 0 0 1 3.1.38 3.3 3.3 0 0 1 1.35 2.82 3.24 3.24 0 0 1 .62 3.1A3.3 3.3 0 0 1 18 16.57a3.24 3.24 0 0 1-1.74 2.63 3.3 3.3 0 0 1-3.12-.03 3.24 3.24 0 0 1-3.09-.34A3.3 3.3 0 0 1 8.7 16a3.24 3.24 0 0 1-.62-3.08A3.3 3.3 0 0 1 10 7.42a3.24 3.24 0 0 1 2-.72Z" stroke="#E9FFF8" stroke-width="1.5"/>
      <path d="m9.2 9.2 5.5 3.2M9.3 14.8h6.1M14.6 9.1l-3.2 5.7" stroke="#E9FFF8" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  claude: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="6" fill="#D97757"/>
      <path d="M8.2 12c0-2.5 1.64-4.3 4.03-4.3 1.45 0 2.55.52 3.56 1.58l-1.44 1.4c-.58-.6-1.16-.95-2-.95-1.3 0-2.2.96-2.2 2.27s.9 2.28 2.2 2.28c.84 0 1.42-.35 2-.95l1.44 1.4c-1.01 1.06-2.1 1.58-3.56 1.58-2.39 0-4.03-1.8-4.03-4.31Z" fill="#FFF7F2"/>
    </svg>`,
  gemini: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2c1.06 4.13 2.17 5.9 4.2 7.8C18.1 11.83 19.87 12.94 24 14c-4.13 1.06-5.9 2.17-7.8 4.2C14.17 20.1 13.06 21.87 12 26c-1.06-4.13-2.17-5.9-4.2-7.8C5.9 16.17 4.13 15.06 0 14c4.13-1.06 5.9-2.17 7.8-4.2C9.83 7.9 10.94 6.13 12 2Z" fill="url(#g)" transform="translate(0 -2) scale(.92) translate(1 1)"/>
      <defs>
        <linearGradient id="g" x1="0" y1="14" x2="24" y2="14" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6D8DFF"/>
          <stop offset=".5" stop-color="#47D7C7"/>
          <stop offset="1" stop-color="#FFB347"/>
        </linearGradient>
      </defs>
    </svg>`,
  manus: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="#111827"/>
      <path d="M6.8 16V8h2.06l3.14 3.92L15.14 8h2.06v8h-1.98v-4.6L12 15.28 8.78 11.4V16H6.8Z" fill="#F8FAFC"/>
    </svg>`,
  github: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#0D1117"/>
      <path d="M12 7.2c-2.65 0-4.8 2.19-4.8 4.9 0 2.17 1.38 4 3.3 4.65.24.05.33-.1.33-.24v-.84c-1.34.3-1.62-.58-1.62-.58-.22-.58-.54-.73-.54-.73-.44-.3.04-.3.04-.3.48.03.74.5.74.5.43.74 1.13.52 1.41.4.04-.32.17-.52.3-.64-1.07-.12-2.2-.55-2.2-2.45 0-.54.18-.97.49-1.31-.05-.13-.21-.62.05-1.29 0 0 .4-.13 1.32.5.38-.11.78-.17 1.18-.17s.8.06 1.18.17c.92-.63 1.32-.5 1.32-.5.26.67.1 1.16.05 1.29.31.34.49.77.49 1.31 0 1.9-1.13 2.33-2.21 2.45.18.15.33.46.33.94v1.39c0 .14.09.3.34.24 1.92-.65 3.29-2.48 3.29-4.65 0-2.71-2.15-4.9-4.8-4.9Z" fill="#fff"/>
    </svg>`,
  vercel: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4 21 20H3L12 4Z" fill="#fff"/>
    </svg>`,
  supabase: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8 3.5c.3-.38.92-.16.92.33v9.08l-5.14 7.25c-.3.43-.98.21-.98-.32v-9.1L14.8 3.5Z" fill="#3ECF8E"/>
      <path d="M14.4 3.5H8.9c-.4 0-.63.46-.39.8l5.22 7.25h5.46c.4 0 .63-.45.4-.79L14.4 3.5Z" fill="#B6F3D8"/>
    </svg>`,
  espn: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#E60000"/>
      <path d="M6 8h12M6 12h12M6 16h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  evernote: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#00A82D"/>
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  zoom: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#2D8CFF"/>
      <path d="M8 8h8v3h-3v5H8V8z" fill="#fff"/>
      <path d="M13 11h3v5h-3v-5z" fill="#fff" opacity=".9"/>
    </svg>`,
  grok: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#0A0A0A"/>
      <path d="M7 8h10M7 12h7M7 16h4" stroke="#14B8A6" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  dreamer: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#8B5CF6"/>
      <path d="M8 8h8M8 12h6M8 16h4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  viktor: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#0EA5E9"/>
      <path d="M7 9h10M7 13h8M7 17h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  openclaw: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#059669"/>
      <path d="M7 8h10M7 12h8M7 16h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  kilocode: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#1a1a2e"/>
      <path d="M8 7l4 5-4 5M14 7l4 5-4 5" stroke="#00d4aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  generic: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="#6D8DFF"/>
      <path d="M8 12h8M12 8v8" stroke="#F5F8FF" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
};

export function getIconMarkup(tool) {
  const explicit = tool?.iconKey;
  if (explicit && explicit !== "auto" && appIcons[explicit]) return appIcons[explicit];

  const identity = `${tool?.name ?? ""} ${tool?.url ?? ""}`.toLowerCase();
  if (identity.includes("gmail") || identity.includes("mail.google")) return appIcons.gmail;
  if (identity.includes("slack")) return appIcons.slack;
  if (identity.includes("telegram")) return appIcons.telegram;
  if (identity.includes("calendar.google") || identity.includes("calendar")) return appIcons.calendar;
  if (identity.includes("notion")) return appIcons.notion;
  if (identity.includes("chatgpt") || identity.includes("openai")) return appIcons.chatgpt;
  if (identity.includes("claude")) return appIcons.claude;
  if (identity.includes("gemini")) return appIcons.gemini;
  if (identity.includes("manus")) return appIcons.manus;
  if (identity.includes("github")) return appIcons.github;
  if (identity.includes("vercel")) return appIcons.vercel;
  if (identity.includes("supabase")) return appIcons.supabase;
  if (identity.includes("espn")) return appIcons.espn;
  if (identity.includes("evernote")) return appIcons.evernote;
  if (identity.includes("zoom")) return appIcons.zoom;
  if (identity.includes("grok") || identity.includes("x.ai")) return appIcons.grok;
  if (identity.includes("dreamer")) return appIcons.dreamer;
  if (identity.includes("viktor") || identity.includes("getviktor")) return appIcons.viktor;
  if (identity.includes("openclaw")) return appIcons.openclaw;
  if (identity.includes("kilo") || identity.includes("kilocode")) return appIcons.kilocode;
  return appIcons.generic;
}
