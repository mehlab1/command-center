# Human Final Tasks — Do These AFTER All Code Is Complete

Per the golden rule of batching human tasks, everything left for Mehlab to do personally once
Claude Code has finished building lives here — nothing mid-build.

## 1. APK installation
- Sideload the Phase 7 APK output onto your Android device (enable "install from unknown
  sources" for the install if not already enabled).
- Uninstall/avoid conflict with any "Add to Home Screen" browser-based PWA install made during
  earlier testing, so there's exactly one installed instance of the app.

## 2. Real-world verification pass
Run through the full production-readiness checklist in `docs/08-testing-and-quality-gates.md`
on your actual device, in actual daily use conditions (not a demo environment):
- Let the app sit idle for a real workday, then check morning digest delivery.
- Create a real project, a real dev, a real task, through actual chat use — not test data.
- Confirm a push notification arrives with your phone locked and the app fully closed.
- Try the vault with one real (low-stakes) credential first, confirm it decrypts correctly
  before trusting it with anything sensitive.

## 3. Ongoing free-tier monitoring (not a one-time task, but flagged here as the handoff point)
- Watch Gemini/Groq free-tier usage against their published limits as real daily use ramps up.
- Watch Render's 750 free instance-hours/month if the cron-job.org ping cadence plus your own
  usage pushes close to that ceiling.
- Watch Neon's free-tier storage/compute caps as real data accumulates.

None of this requires code changes unless a real limit is actually hit — if/when that happens,
the LLM router and infrastructure choices were built to be swappable (see CLAUDE.md "Open
Items"), so upgrading a single piece is a config change, not a rebuild.
