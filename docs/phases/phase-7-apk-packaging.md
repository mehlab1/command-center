# Phase 7 — APK Packaging (TWA via Bubblewrap)

**Goal:** a real installable Android APK, wrapping the deployed PWA via Trusted Web Activity,
with genuine background push notifications working — not a bare WebView wrapper.

## Prerequisites
- Phase 6 test gate passed — push notifications must already be confirmed working in the
  installed-PWA-via-browser context before wrapping in a TWA, since a TWA relies on the same
  underlying service worker/push infrastructure.
- Domain decision from `docs/00-human-setup-tasks.md` finalized and stable.

## Tasks

1. **Digital Asset Links.** Serve `/.well-known/assetlinks.json` from the PWA's production
   domain, linking it to the Android app's signing key fingerprint (Bubblewrap can help
   generate the correct content once the keystore exists).

2. **Bubblewrap init.** Run Bubblewrap's interactive setup against the deployed PWA's
   manifest URL, generating `twa-manifest.json`. Reuse values already defined in
   `manifest.json` where applicable (name, icons, theme colors) rather than redefining them.

3. **Keystore.** Generate a new Android keystore (or use an existing one if Mehlab already has
   one from prior Flutter/Android work — check before generating a fresh one) and store it
   securely outside the git repo.

4. **Build.** Run `bubblewrap build` to produce the APK. Bubblewrap will run a Lighthouse PWA
   audit as part of this — resolve any audit failures before proceeding (these usually indicate
   a real gap in the manifest or service worker, not a false positive).

5. **Verification.** Confirm the Digital Asset Links file correctly validates against the
   built APK's signing key (Bubblewrap/Android tooling can verify this).

## Human tasks (from `docs/99-human-final-tasks.md`, executed here)

- Sideload the built APK onto Mehlab's actual Android device.
- Confirm "Add to Home Screen" browser-install PWA is uninstalled/not conflicting with the new
  native APK install (avoid confusion between the two installation methods).
- Manually test the full app flow on the real device: login, chat with the agent, view
  dashboard, receive a push notification with the phone locked.

## Test Gate — final gate for the whole project

- [ ] APK installs successfully on Mehlab's real Android device via sideload.
- [ ] The installed app opens directly into the PWA content, full-screen, no browser chrome
      visible (confirms TWA is working correctly, not falling back to a browser tab).
- [ ] A push notification is received and displayed correctly with the app fully closed (not
      just backgrounded) and the phone locked — this is the core requirement that distinguishes
      a real TWA from a WebView wrapper, verify it explicitly.
- [ ] Tapping a notification deep-links into the correct view within the app.
- [ ] Full production-readiness checklist in `docs/08-testing-and-quality-gates.md` is
      complete.
