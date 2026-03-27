# MYRA — Style with AI

Bare React Native CLI app (v0.84.1, New Architecture) with a Node.js/Express backend and Python/FastAPI AI service.

---

## Mac Prerequisites

Install these once before cloning. **Node version matters — do not skip the version check.**

| Tool | Version | Install |
|------|---------|---------|
| Xcode | Latest stable | App Store |
| Xcode Command Line Tools | — | `xcode-select --install` |
| Node.js | **22.x** | `brew install node@22` |
| Watchman | Latest | `brew install watchman` |
| Ruby | >= 2.6.10 | macOS system Ruby is fine |
| Bundler | 2.4.22 | See Bundler install note below |
| Python | 3.10+ | `brew install python@3.11` |

Verify Node before continuing:

```bash
node --version   # must show v22.x.x
```

---

## First-Time Setup (iOS Simulator)

Run these once after cloning:

```bash
# 1. Switch to correct Node version
nvm use            # reads .nvmrc → Node 22
# OR if using Homebrew directly:
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# 2. Install JS dependencies
npm install

# 3. Install Bundler 2.4.22 (compatible with macOS system Ruby 2.6)
# --user-install avoids permission errors on the protected system Ruby
gem install --user-install bundler:2.4.22
export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"
# Make the PATH permanent:
echo 'export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"' >> ~/.zshrc

# 4. Install Ruby gems (locks CocoaPods to the version in Gemfile.lock)
bundle install

# 5. Install iOS Pods
npm run pods

# 6. Set up environment
cp .env.example .env
# Edit .env — fill in MONGO_URI, JWT_SECRET, INTERNAL_TOKEN for backend
# Mobile simulator uses localhost fallbacks — API_URL and AI_BASE_URL are optional for local dev

# 7. Set Xcode's Node binary path (machine-specific, gitignored — run once per machine)
echo 'export NODE_BINARY=$(command -v node)' > ios/.xcode.env.local
```

---

## Running the App (Every Session)

Open separate terminal windows from the repo root:

**Terminal 1 — Metro Bundler (required)**

```bash
npm start
```

Wait for the `BUNDLE ./index.js` line before launching the simulator.

**Terminal 2 — iOS Simulator**

```bash
npm run ios
```

This targets the default simulator. To target iPhone 16 on iOS 18 explicitly (recommended):

```bash
npx react-native run-ios --simulator "iPhone 16"
```

> If your machine has both iOS 18 and iOS 26 simulators, pin to iOS 18 for stability with React Native 0.84.1.
> To list available simulators: `xcrun simctl list devices available | grep iPhone`

**Terminal 3 — Node.js Backend** (optional for UI-only work)

```bash
npm run backend
# Runs on http://localhost:5001
```

**Terminal 4 — Python AI Service** (optional — only needed for AI outfit features)

```bash
cd backend
python -m venv .venv        # first time only
source .venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn app:app --host 0.0.0.0 --port 5002 --reload
```

---

## Environment Setup

Copy `.env.example` to `.env` at the repo root.

| Variable | Required | Notes |
|----------|----------|-------|
| `MONGO_URI` | Yes (backend) | MongoDB Atlas URI or `mongodb://localhost:27017` |
| `JWT_SECRET` | Yes (backend) | Any long random string |
| `INTERNAL_TOKEN` | Yes (backend) | Any long random string |
| `OPENAI_API_KEY` | Yes (AI service) | OpenAI key for outfit suggestions |
| `API_URL` | Dev optional | Mobile → backend. Falls back to `localhost:5001` in dev |
| `AI_BASE_URL` | Dev optional | Mobile → AI service. Falls back to `localhost:5002` in dev |
| `ENABLE_AI` | No | Set `true` to enable AI features |
| `R2_*` vars | Optional | Cloudflare R2 — only needed for image upload in production |

---

## Xcode NODE_BINARY (required once per machine)

Xcode build phases need to find your Node binary. This file is gitignored — create it locally after each fresh clone:

```bash
echo 'export NODE_BINARY=$(command -v node)' > ios/.xcode.env.local
```

If using nvm:

```bash
echo 'export NODE_BINARY=$(. ~/.nvm/nvm.sh --no-use && nvm which 22)' > ios/.xcode.env.local
```

---

## Full Clean Reset

If something breaks or you want a completely fresh state:

```bash
npm run clean
npm start -- --reset-cache
```

`npm run clean` removes `node_modules`, `ios/Pods`, `ios/build`, and Xcode DerivedData for this project, then reinstalls everything.

---

## Troubleshooting

### Wrong Node version

**Symptom:** `npm warn EBADENGINE` or Metro fails to start

```bash
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
node --version   # → v22.x.x
```

### Pod issues — "No such module" in Xcode

```bash
npm run pods
```

If that does not fix it, do a full reset:

```bash
npm run clean
```

### Metro not running — red error screen in simulator

Metro must be running before launching the simulator. Start `npm start` in Terminal 1 and wait for the bundle message, then run `npm run ios` in Terminal 2.

### Simulator picks wrong iOS version

Explicitly target iOS 18:

```bash
npx react-native run-ios --simulator "iPhone 16"
```

List all available simulators:

```bash
xcrun simctl list devices available | grep iPhone
```

### Watchman errors — file watching issues

```bash
watchman watch-del-all
watchman shutdown-server
npm start -- --reset-cache
```

### Bundler version error — "Could not find 'bundler' (X.X.X)"

**Symptom:** `Could not find 'bundler' (2.4.22) required by Gemfile.lock`

On macOS system Ruby 2.6, use `--user-install` to avoid permission errors:

```bash
gem install --user-install bundler:2.4.22
export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"
bundle --version   # → Bundler version 2.4.22
bundle install
```

Add the PATH export to `~/.zshrc` so it persists across sessions.

### CocoaPods version mismatch

Always use `bundle exec` — never run bare `pod install`:

```bash
npm run pods          # correct — uses Gemfile.lock version
pod install           # wrong — uses system CocoaPods
```

### Xcode cannot find Node during build

Check that `ios/.xcode.env.local` exists and points to your Node 22 binary:

```bash
cat ios/.xcode.env.local
# should show: export NODE_BINARY=$(command -v node)
node --version   # should show v22.x.x
```

If the file is missing, recreate it:

```bash
echo 'export NODE_BINARY=$(command -v node)' > ios/.xcode.env.local
```

---

## Project Structure

```
repo root/            ← React Native app (bare CLI)
├── src/              ← screens, navigation, stores, API layer
│   ├── screens/      ← all app screens
│   ├── navigation/   ← RootNavigator + Tabs
│   ├── context/      ← Auth and Theme providers
│   ├── store/        ← Zustand state stores
│   ├── api/          ← axios API layer
│   └── stubs/        ← @expo/vector-icons → react-native-vector-icons shim
├── ios/              ← Xcode project and CocoaPods
├── android/          ← Android project
├── assets/           ← 3D models and static assets
├── backend/          ← Node.js Express API (port 5001)
│   ├── index.js      ← server entry point
│   ├── app.py        ← Python FastAPI AI service (port 5002)
│   ├── routes/       ← API route handlers
│   └── services/     ← business logic and integrations
└── scripts/          ← build helper scripts
```
