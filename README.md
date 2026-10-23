# Personal Chat

A mobile-first personal chat web app built with React + Vite + Tailwind CSS and
Firebase (Authentication + Cloud Firestore), with optional Firebase Storage or
a separate PHP media backend for images/voice notes. The UI follows
the **OWN LABRARY** design tokens (accent `#4f6bed`, 6px radii, iOS-like
spacing/typography, light + dark theme).

There are **no fake users or demo messages**. Every list, message, edit,
reaction, unread count and profile change comes from Firebase in real time.

## Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/login` | `src/pages/LoginPage.jsx` | Mobile number + password login |
| `/register` | `src/pages/RegisterPage.jsx` | Create account + Firestore profile |
| `/` | `src/pages/HomePage.jsx` | All users, search, last message, unread badge |
| `/chat/:uid` | `src/pages/ChatPage.jsx` | Private text chat (photo, reply, edit, delete, reactions) |
| `/voice` | `src/pages/VoicePackPage.jsx` | All users for Voice Pack |
| `/voice/:uid` | `src/pages/VoiceChatPage.jsx` | Private voice-note chat |
| `/profile` | `src/pages/ProfilePage.jsx` | Photo, name, mobile, bio, logout |

Common components live in `src/components`, Firebase integration in
`src/services`, shared state in `src/context`, and data hooks in `src/hooks`.

## 1. Install

```bash
cd chat-app
npm install
```

## 2. Create a Firebase project

1. <https://console.firebase.google.com/> → **Add project**.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database** (production mode is fine, rules are
   provided below).
4. **Storage → Get started** (optional; needed only for Firebase-hosted
   images/voice notes). If Storage is not available on your plan, use the PHP
   backend described in section 5 instead.
5. **Project settings → Your apps → Web** and copy the config values.

## 3. Environment file

```bash
cp .env.example .env
```

Fill in:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
```

`VITE_FIREBASE_STORAGE_BUCKET` automatically enables the Firebase Storage
adapter. Without it, the app runs in **text-only mode**: text chat works fully,
while the Voice Pack tab, photo attachments and profile-photo upload stay
hidden. Nothing is silently faked, and you can re-enable media later with either
Firebase Storage or the HTTP uploader below.

## 4. Deploy security rules

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # select your project
firebase deploy --only firestore:rules
# add ",storage" only if Firebase Storage is enabled
```

Rules in this repo:

- `firestore.rules` — signed-in only, owner-only profiles, participants-only
  chats (both `chats` and `voiceChats`), sender-only edits/deletes.
- `storage.rules` — optional; uploads restricted to the signed-in user,
  size/MIME limits, chat files only readable by the two participants encoded in
  the chat id.

## 5. Storage adapter (optional HTTP uploader)

Binary files are **never** written to Firestore; only URLs + metadata are
stored. Two adapters are available in `src/services/storageAdapter.js`:

- **Firebase Storage** (default when a bucket is set).
- **HTTP endpoint** — set:

```env
VITE_STORAGE_PROVIDER=http
VITE_UPLOAD_ENDPOINT=https://your-server.example/upload
VITE_UPLOAD_TOKEN=optional-bearer-token
```

The endpoint receives `multipart/form-data` with `file` and `folder`, and must
return JSON:

```json
{ "url": "https://cdn.example/file.webp", "path": "chatImages/uidA_uidB/file.webp" }
```

### Bundled PHP backend

If Firebase Storage is not available, use the ready-made backend in
[`backend-php/`](backend-php/README.md). It runs on any PHP 8 host, can be
hosted on a different domain from the frontend, validates Firebase ID tokens,
checks chat participants, and serves files through signed URLs.

```env
VITE_STORAGE_PROVIDER=http
VITE_UPLOAD_ENDPOINT=https://api.your-domain.com/upload.php
# VITE_UPLOAD_TOKEN stays empty for the bundled backend
```

Deploy the PHP backend separately; see its README for the document root, CORS,
storage permissions and configuration. No Firebase Storage/Blaze plan is
required. Open the backend URL after deployment for its status dashboard, which
lists working features and any configuration errors.

## 6. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview
npm run lint
```

If port `5173` is already in use, pass another port, for example
`npm run dev -- --port 5180`.

To test on your phone over the LAN, run the dev server and open
`http://<computer-ip>:5173`. Microphone recording and the clipboard API require a
secure context: they work on `localhost` and on any HTTPS deployment, but most
mobile browsers block them over plain LAN HTTP. For real phone testing deploy
with Firebase Hosting:

```bash
npm run build
firebase deploy --only hosting
```

## 7. Local testing with the Firebase Emulator Suite

No real Firebase project is required for local testing. The emulators use the
`demo-personal-chat` project and the same security rules as production.

```bash
firebase emulators:start --only auth,firestore,storage --project demo-personal-chat
npm run dev -- --port 5180
```

`.env.local` (gitignored) contains the demo configuration:

```env
VITE_FIREBASE_PROJECT_ID=demo-personal-chat
VITE_FIREBASE_API_KEY=demo-api-key
VITE_USE_FIREBASE_EMULATORS=true
VITE_EMULATOR_HOST=127.0.0.1
```

- App: <http://localhost:5180/>
- Emulator UI: <http://127.0.0.1:4000/>
- Register any mobile number and password; emulator data is cleared when the
  emulators stop.
- The emulators bind to `127.0.0.1`. To test from another device, bind them to
  `0.0.0.0` and set `VITE_EMULATOR_HOST` to this machine's LAN IP.

## 8. Production deployment

Production builds **refuse to compile** with demo/emulator values. This includes
`.env.local`, which overrides `.env` during a local build and is gitignored.

1. In the Firebase Console, enable **Authentication → Email/Password**, create
   **Firestore**, and create **Storage** if you want image/voice uploads.
2. Fill real values in `.env` (`cp .env.example .env`).
3. Move the local emulator config out of the way:
   ```bash
   mv .env.local .env.local.testing
   ```
4. Select the real project (creates a gitignored `.firebaserc`):
   ```bash
   firebase login
   firebase use --add
   ```
5. For images/voice notes, deploy `backend-php/` to your PHP host and set
   `VITE_STORAGE_PROVIDER=http` + `VITE_UPLOAD_ENDPOINT` in `.env` before
   building. See [`backend-php/README.md`](backend-php/README.md).
6. Build and deploy:
   ```bash
   npm run build
   firebase deploy --only firestore:rules,hosting
   ```
   Add `storage` to `--only` only if Firebase Storage is enabled.
7. In **Authentication → Settings → Authorized domains**, add the Hosting domain
   (`<project>.web.app` / your custom domain).
8. To return to local emulator testing:
   ```bash
   mv .env.local.testing .env.local
   ```

The generated `dist/` folder is intentionally gitignored and is never committed.

### Vercel frontend

Set **Root Directory** to the repository root (leave it empty) and add these
variables in **Vercel → Project → Settings → Environment Variables** for the
**Production** environment:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
# omit VITE_FIREBASE_STORAGE_BUCKET when using the PHP backend
VITE_STORAGE_PROVIDER=http
VITE_UPLOAD_ENDPOINT=https://api.your-domain.com/upload.php
```

Redeploy after adding variables — Vercel only reads them during a new build.
`vercel.json` adds the SPA rewrite so `/chat/:uid` and `/profile` survive a
refresh. Also add the Vercel domain (`<project>.vercel.app` and any custom
domain) to Firebase **Authentication → Settings → Authorized domains**, and to
`allowed_origins` in the PHP backend config.

If the build fails with `Missing: VITE_FIREBASE_...`, those variables are not
visible to the build. Check that they are added to the Production environment
and trigger a new deployment.

This repo also includes `.env.production` with the public Firebase web config,
so a Git-based Vercel deploy works without dashboard variables. Vercel
environment variables (if set) take precedence. The Firebase web API key is a
public client identifier, not a server secret — protect the project with the
included Firestore rules and API key restrictions.

## Authentication design (mobile number + password)

Firebase's native phone sign-in is OTP-based and has no password method. This
app therefore uses **Firebase Email/Password** as the credential store with a
deterministic internal identifier derived from the mobile number:

```
9876543210  ->  m9876543210@chat.local
```

- Passwords are hashed and managed by Firebase Authentication. They are never
  written to Firestore or any custom field.
- Duplicate mobile numbers are rejected by Firebase Auth (`email-already-in-use`
  mapped to "This mobile number is already registered").
- To use a real backend/OTP flow later, only `src/services/authAdapter.js` needs
  to change; pages depend on `authService` only.

## Firestore data model

```
users/{uid}
  uid, displayName, mobileNumber, photoURL, bio,
  createdAt, updatedAt, lastSeen

chats/{uidA_uidB}
  participants: [uidA, uidB]
  lastMessage: { id, type, text, senderId, createdAt, edited, deletedForEveryone }
  unread: { [uid]: number }
  createdAt, updatedAt

chats/{uidA_uidB}/messages/{messageId}
  senderId, type: "text" | "image", text,
  imageUrl, replyTo, reactions: { [uid]: emoji },
  hiddenFor: [uid], deletedForEveryone, createdAt, editedAt

voiceChats/...   (same shape, type: "voice", audioUrl + duration)
```

`delete for me` uses `hiddenFor`; `delete for everyone` clears the payload and
sets `deletedForEveryone`. `unread` is incremented for the recipient on send and
reset to 0 when the chat is opened.

The thread subscribes to the latest 500 messages (live). Older history can be
added with pagination later without changing the data model.
