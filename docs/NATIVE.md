# Shipping CodeCraft as a native app

The game is a set of plain files with no build step, and that does not change
here. Capacitor wraps those same files in a native shell — the web app *is* the
app, so there is no second codebase and no port to maintain.

```
index.html + js/ + css/ + fonts/   the game (unchanged)
        │
        ├── GitHub Pages ────────► tomeryul.github.io/CodeCraft   (the website)
        └── scripts/build-www.js ─► www/ ──► ios/ + android/      (the app)
```

---

## The short version

```bash
npm install
npm run sync            # stage www/ and push it into both native projects
npm run open:android    # opens Android Studio
npm run open:ios        # opens Xcode (macOS only)
```

Everything after `npm run sync` is the platform's own toolchain, not ours.

---

## What actually needs a Mac

| Task | Needs macOS? |
|---|---|
| Editing the game | no |
| `cap sync`, `cap add`, generating icons | no |
| Building an Android APK / AAB | no |
| Running the iOS simulator | **yes** |
| Building, signing, uploading to App Store | **yes** |

There is no way around the last two: Apple only allows iOS builds on macOS. If
you have no Mac, the `ios` job in `.github/workflows/native.yml` runs on a
GitHub-hosted macOS runner (`workflow_dispatch`, so it runs on request rather
than on every push — macOS minutes are billed at ten times the Linux rate).

---

## How the web app changes when it is packaged

`js/game/native.js` handles four differences. Each was a real bug, not a
nicety — see the comment at the top of that file for why.

1. **The save survives.** iOS may evict a webview's `localStorage`, and the
   whole game lives there. Every save is mirrored into native storage
   (`@capacitor/preferences`) and restored on launch if the fast copy has gone.
2. **The back button** closes the topmost sheet instead of quitting, and only
   leaves the app from the map. The age gate deliberately ignores it.
3. **`target="_blank"`** is intercepted and opened through the native browser,
   or the privacy policy link would be a dead end.
4. **No service worker.** A packaged app is already local; `www/` deliberately
   does not contain `sw.js`, and registration is skipped.

`test/native.js` covers all four against a fake Capacitor bridge, including
the eviction-and-restore path.

---

## Icons

Regenerate from the game's own CSS mascot — do not hand-edit the files inside
`ios/` or `android/`, they are overwritten:

```bash
node scripts/make-icons.js       # → build/icon-1024.png, icon-fg.png, icon-bg.png
cp build/icon-1024.png assets/icon.png
cp build/icon-fg.png   assets/icon-foreground.png
cp build/icon-bg.png   assets/icon-background.png
npx @capacitor/assets generate --iconBackgroundColor '#4a2f9e' \
    --iconBackgroundColorDark '#4a2f9e' \
    --splashBackgroundColor '#1a1230' --splashBackgroundColorDark '#1a1230'
```

Two rules that are easy to get wrong and are already handled:

- The iOS store icon must be **1024×1024, square, with no alpha channel**.
  Apple applies its own rounded mask, so a pre-rounded icon comes out
  double-rounded, and an alpha channel is rejected outright.
- Android's adaptive icon crops the foreground to whatever shape the launcher
  likes; only the middle ~66% is guaranteed visible, so `icon-fg.png` is
  rendered with padding.

---

## Before the first submission

- [ ] **Contact address in `privacy.html`** — it is still a `TODO` block.
      Set the same address in App Store Connect.
- [ ] **Bundle ID.** Currently `io.github.tomeryul.codecraft`, in
      `capacitor.config.json`, `android/app/build.gradle` and the Xcode
      project. Change it before the first upload; afterwards it is permanent.
- [ ] **Version.** `versionName`/`versionCode` in `android/app/build.gradle`,
      `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` in Xcode. Both start at 1.0.
- [ ] **Age rating.** The questionnaire in each store. There is no chat, no
      ads, no purchases, no user-to-user messaging — but there *is*
      user-generated content (published levels), so answer that honestly. The
      reporting and blocking added in `js/game/moderation.js` is what the
      stores want to see alongside that answer.
- [ ] **Apple's Kids Category is a separate decision.** Entering it forbids
      third-party analytics and behavioural ads outright — CodeCraft has
      neither, so it qualifies — but it also brings stricter review. Staying
      out of it and shipping as a normal 4+ app is entirely valid.
- [ ] **Android signing.** Generate a keystore, then add
      `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
      `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` as repository secrets. The
      release job skips itself until they exist, so CI stays green before then.
      **Keep the keystore.** Losing it means never updating that listing again.

Already handled, so they do not need doing again:

- `ITSAppUsesNonExemptEncryption=false` is in `Info.plist` — the app only uses
  standard HTTPS, so App Store Connect stops asking on every upload.
- The only Android permission requested is `INTERNET`. No camera, location,
  contacts or storage, which is what the privacy policy claims.
- Account deletion is reachable in-app, which Apple requires of any app that
  offers sign-up (Guideline 5.1.1(v)).

---

## Why `ios/` and `android/` are committed

Because they are not purely generated: icons, `Info.plist`, versions and
signing config all live there, and `cap add` would wipe them. What *is*
regenerated — the copied web assets under `App/public` and
`assets/public` — is gitignored, so the game is not stored three times.

To rebuild a platform from scratch:

```bash
rm -rf android && npm run add:android    # then redo icons and any Info.plist edits
```

---

## Supabase from inside the app

Requests come from `capacitor://localhost` (iOS) or `https://localhost`
(Android) rather than from the Pages origin. Supabase's REST API authorises on
the `apikey` header rather than the origin, so this needs no CORS change — but
it is the first thing to check if network calls work on the website and not in
the app.
