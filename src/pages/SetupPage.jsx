import { DatabaseZap, ExternalLink } from "lucide-react";
import { BrandMark } from "../components/BrandMark";
import { ThemeToggle } from "../components/ThemeToggle";

const ENV_LINES = [
    "VITE_FIREBASE_API_KEY=...",
    "VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com",
    "VITE_FIREBASE_PROJECT_ID=your-project",
    "VITE_FIREBASE_APP_ID=...",
    "VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app"
];

export default function SetupPage() {
    return (
        <div className="app-frame">
            <header className="safe-top flex items-center justify-between border-b border-line px-4 py-3">
                <BrandMark size={32} withName />
                <ThemeToggle />
            </header>

            <main className="mx-auto w-full max-w-xl px-4 py-10">
                <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <DatabaseZap className="size-6" />
                </span>
                <h1 className="text-xl font-bold tracking-tight">Connect your Firebase project</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                    The app is installed but not connected yet. Create a{" "}
                    <code className="rounded bg-card px-1 py-0.5 text-xs">.env</code> file in the
                    project folder with your Firebase web app keys, then restart the dev server.
                    No data or features are simulated without it.
                </p>

                <div className="panel mt-6 p-4">
                    <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted">
                        .env
                    </p>
                    <pre className="overflow-x-auto rounded bg-bg px-3 py-3 text-xs leading-relaxed">
                        {ENV_LINES.join("\n")}
                    </pre>
                </div>

                <ol className="mt-6 space-y-2 text-sm text-muted">
                    <li>1. Open Firebase Console → Authentication → enable Email/Password.</li>
                    <li>2. Create a Cloud Firestore database.</li>
                    <li>3. Enable Storage for images and voice notes (or use the HTTP uploader).</li>
                    <li>4. Deploy the included rules: firestore.rules and storage.rules.</li>
                </ol>

                <a
                    className="btn btn-outline btn-sm mt-6"
                    href="https://console.firebase.google.com/"
                    target="_blank"
                    rel="noreferrer"
                >
                    Open Firebase Console <ExternalLink className="size-3.5" />
                </a>
            </main>
        </div>
    );
}
