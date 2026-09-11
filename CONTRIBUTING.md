# Contributing

If you use BandAid and want to improve it, welcome.

## Setting up locally

```bash
git clone https://github.com/Nirmal2OO8/BandAid
cd BandAid
npm install
npm run dev
```

You need a Discogs API key. Add it to your local config before running — see the README for the exact setup steps.

## The core principle

BandAid is a local-first, offline-capable music library. The SQLite database on the user's machine is the source of truth. Features that require a persistent internet connection or a remote database are the wrong direction.

## What's worth contributing

- Bug fixes in the library scanner or metadata resolver
- Improved Discogs metadata matching for edge cases (box sets, bootlegs, compilations)
- Performance improvements for large libraries (10,000+ tracks)
- Better offline fallback behaviour
- Windows and Linux compatibility fixes

## What's probably not worth contributing

- Cloud sync or remote storage — that's a different project
- Switching from SQLite to a remote database
- Major UI overhauls — open an issue with a mockup first

## Pull requests

Keep them focused. One thing per PR. Open an issue first for anything non-trivial.

Write a clear commit message. "Fix" tells me nothing. "Fix scanner ignoring nested album folders on Windows" tells me everything.

## Never commit

- Discogs API keys or OAuth tokens
- Any user's personal music library data or paths
