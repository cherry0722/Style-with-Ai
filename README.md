# MYRA — Style with AI

MYRA is an AI-powered wardrobe and outfit recommendation app for iOS. It helps a user turn the items already in their closet into occasion-based outfit suggestions, explains why those combinations work, and previews looks on a 3D avatar before they are saved or planned. The project is built with a React Native iOS client, a Node.js backend, a Python/FastAPI AI service, and OpenAI-powered outfit generation.

---

## Features

- **AI outfit recommendations** — generates 3 outfit options from the user's wardrobe for a selected occasion, with reasoning for each suggestion
- **3D avatar visualization** — previews the selected look on a dressed avatar using Filament, with outfit color changes applied without reloading the model
- **Wardrobe capture and cataloging** — lets users photograph and organize clothing items; images are stored on Cloudflare R2
- **Saved looks and planning** — bookmark generated outfits and schedule them for "Wear Today" or a future date
- **Context-aware suggestions** — incorporates occasion and optional weather context to make recommendations feel more practical
- **Fallback behavior for demo stability** — if the Python AI service is unavailable, the app can still return deterministic outfit combinations through the Node backend

---

## Architecture

```
iOS app (React Native 0.84.1, bare CLI)
    │
    ├── Captures wardrobe input, requests outfit suggestions,
    │   and renders 3D avatar previews
    │
    ├── Node.js / Express (port 5001)
    │        ├── primary mobile API layer
    │        ├── /api/auth         JWT auth (login, signup, refresh)
    │        ├── /api/wardrobe     wardrobe CRUD + R2 upload
    │        ├── /api/saved        saved outfits
    │        ├── /api/planner      calendar planner
    │        └── /api/ai           forwards AI requests to Python; falls back if needed
    │
    └── Python / FastAPI (port 5002)
             ├── POST /outfit-suggestions   reads wardrobe data and calls OpenAI
             └── POST /avatar-mapping       maps outfit items to avatar configuration
```

**State management:** Zustand  
**3D rendering:** react-native-filament (Filament engine via JSI)  
**Database:** MongoDB Atlas  
**Image storage:** Cloudflare R2  
**AI stack:** Node.js orchestrates app requests, Python/FastAPI handles outfit-generation logic, and OpenAI powers recommendation output

---

## Repo Structure

```
repo root/
├── src/
│   ├── screens/          all app screens (Avatar, Wardrobe, Saved, Planner, …)
│   ├── navigation/       RootNavigator + Tabs
│   ├── context/          Auth and Theme providers
│   ├── store/            Zustand state stores
│   ├── api/              Axios API layer (client.ts, ai.ts, avatar.ts, …)
│   ├── avatar/           avatarClothingConfig.ts — GLB resolution and tint logic
│   └── constants/        occasions, themes
├── assets/
│   └── models/
│       ├── avatar/       avatar_base_male.glb (589 KB)
│       └── combined/     avatar_tshirt_pants_male_v1.glb (14 MB)
│                         avatar_shortsleeve_pants.glb (20 MB)
├── backend/
│   ├── index.js          Node.js server entry (port 5001)
│   ├── app.py            Python FastAPI entry (port 5002)
│   ├── routes/           Express route handlers
│   └── services/         business logic, avatar_mapping.py, OpenAI caller
├── ios/                  Xcode project + CocoaPods
├── android/              Android project (not the primary target)
├── .env.example          all required environment variable keys
└── scripts/              build helper scripts
```

---

## Prerequisites

Install these once. **Node 22 is required — other versions cause Metro failures.**

Xcode must include an installed iOS Simulator runtime before you try to launch the app.

| Tool | Version | Install |
|------|---------|---------|
| Xcode | Latest stable | App Store |
| Xcode Command Line Tools | — | `xcode-select --install` |
| Node.js | **22.x** | `brew install node@22` |
| Watchman | Latest | `brew install watchman` |
| Ruby | >= 2.6.10 | macOS system Ruby is fine |
| Bundler | 2.4.22 | `gem install --user-install bundler:2.4.22` |
| Python | 3.10+ | `brew install python@3.11` |

```bash
node --version   # must show v22.x.x
```

---

## Environment Setup

Copy `.env.example` to `.env` at the repo root and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|----------|----------|-------|
| `MONGO_URI` | Yes (backend) | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes (backend) | Any 32+ char random string |
| `INTERNAL_TOKEN` | Yes (backend) | Shared secret Node → Python; must match on both sides |
| `OPENAI_API_KEY` | Yes (AI) | OpenAI key; used by Python service for outfit suggestions |
| `API_URL` | Mobile → Node | `http://localhost:5001` for local dev; Render URL for cloud |
| `AI_BASE_URL` | Mobile → Python | `http://localhost:5002` for local dev; Render URL for cloud |
| `ENABLE_AI` | No | `true` to enable AI outfit generation |
| `AI_SERVICE_URL` | Node → Python | `http://127.0.0.1:5002` locally; use a hosted Python URL only if not running it on your Mac |
| `AI_USE_MOCK_DB` | No | Python: `false` = real MongoDB, `true` = mock wardrobe data |
| `NODE_PORT` | No | Default `5001` |
| `AI_TIMEOUT_MS` | No | Default `180000` (3 min) |
| `WEATHER_API_KEY` | Optional | OpenWeatherMap; suggestions degrade gracefully without it |
| `R2_*` | Optional | Cloudflare R2 image storage; only needed in production |

> The iOS Simulator can use `localhost` directly. A physical iPhone cannot, so use your Mac's LAN IP or a hosted backend URL.

---

## First-Time Setup

Run these once after cloning:

```bash
# 1. Pin Node version
nvm use                     # reads .nvmrc → Node 22
# OR if using Homebrew:
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# 2. Install JS dependencies
npm install

# 3. Install Bundler (locks CocoaPods to Gemfile.lock version)
gem install --user-install bundler:2.4.22
export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"
echo 'export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"' >> ~/.zshrc

# 4. Install Ruby gems
bundle install

# 5. Install iOS Pods
npm run pods

# 6. Set Xcode's Node binary path (gitignored — run once per machine)
echo 'export NODE_BINARY=$(command -v node)' > ios/.xcode.env.local
```

---

## Local Dev Run Order (Simulator)

Start services in this order. Each needs its own terminal.

**Terminal 1 — Python AI service**

```bash
cd backend
python -m venv .venv        # first time only
source .venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn app:app --host 127.0.0.1 --port 5002 --reload
```

Health check: `curl http://localhost:5002/health`

**Terminal 2 — Node.js backend**

```bash
npm run backend
# Runs on http://localhost:5001
```

Health check: `curl http://localhost:5001/health`

**Terminal 3 — Metro Bundler**

```bash
npm start
```

Wait for the `BUNDLE ./index.js` line before launching the simulator.

**Terminal 4 — iOS Simulator**

```bash
npm run ios
# or, to pin to a specific simulator:
npx react-native run-ios --simulator "iPhone 17 Pro"
```

> To list available simulators: `xcrun simctl list devices available | grep iPhone`
>
> If your machine has both iOS 18 and iOS 26 simulators, pin to iOS 18 for stability with React Native 0.84.1.

---

## Optional: Simulator + Render

If you want to run the app without starting local backend services, you can point the mobile app at hosted Node and Python URLs instead. Update `API_URL` and `AI_BASE_URL` in your local `.env`, then run only Metro and the simulator:

```bash
npm start          # Terminal 1
npm run ios        # Terminal 2
```

> If you use Render free-tier services, the first request after inactivity may take 30–60 seconds.

---

## Avatar — Demo Behaviour Note

The 3D avatar screen uses a **single combined GLB** (`avatar_tshirt_pants_male_v1.glb`) for the demo flow. This prevents repeated Filament GLB remounts during outfit carousel navigation, which caused `EXC_CRASH (SIGABRT)` on `filament.render.queue` with large assets. The avatar loads once on screen mount with neutral tints; outfit-specific colors are applied via material tinting without reloading the model. `avatar_shortsleeve_pants.glb` is not loaded during normal navigation.

---

## Full Clean Reset

```bash
npm run clean
npm start -- --reset-cache
```

`npm run clean` removes `node_modules`, `ios/Pods`, `ios/build`, and Xcode DerivedData, then reinstalls everything.

---

## Troubleshooting

### Wrong simulator opens

Explicitly target the simulator you want:

```bash
npx react-native run-ios --simulator "iPhone 17 Pro"
xcrun simctl list devices available | grep iPhone
```

### Metro port 8081 already in use

```bash
lsof -ti :8081 | xargs kill -9
npm start
```

### Metro not running — red error screen in simulator

Metro must be running before launching the simulator. Start `npm start` first and wait for the bundle message, then `npm run ios`.

### Localhost not reachable on a physical iPhone

`localhost` resolves to the iPhone itself, not your Mac. Options:
- Use your Mac's LAN IP: `http://192.168.x.x:5001` (check with `ifconfig | grep "inet "`)
- Or use a hosted backend URL instead

### Backend health checks

```bash
# Node backend
curl http://localhost:5001/health

# Python AI service
curl http://localhost:5002/health

# If Python is not running, outfit generation falls back to Node's
# deterministic selector — outfits still appear, just without GPT reasoning.
```

### Avatar crash / Filament crash on outfit navigation

If the app crashes with `EXC_CRASH (SIGABRT)` on `filament.render.queue` when navigating outfits:

- The demo is designed to use only the tshirt+pants combined avatar (see Avatar note above). If you see this crash in a development build with modified avatar code, check that `SceneContent` initializes with `DEMO_INITIAL_CONFIG` rather than `EMPTY_RENDER_CONFIG` in `src/screens/Avatar3DScreen.tsx`.
- Rapid next/prev taps during avatar load are blocked by a nav lock. If pressing Next immediately after Generate causes a crash, ensure `GLB_SETTLE_MS` (currently 1500 ms) is large enough for your simulator speed.

### Wrong Node version

```bash
brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
node --version   # → v22.x.x
```

### Pod issues — "No such module" in Xcode

```bash
npm run pods
# If that fails:
npm run clean
```

### Bundler version error

```bash
gem install --user-install bundler:2.4.22
export PATH="$HOME/.gem/ruby/2.6.0/bin:$PATH"
bundle --version   # → Bundler version 2.4.22
bundle install
```

Add the PATH export to `~/.zshrc` so it persists across sessions.

### Watchman errors

```bash
watchman watch-del-all
watchman shutdown-server
npm start -- --reset-cache
```

### Xcode cannot find Node during build

```bash
cat ios/.xcode.env.local
# should contain: export NODE_BINARY=$(command -v node)
```

If missing:

```bash
echo 'export NODE_BINARY=$(command -v node)' > ios/.xcode.env.local
```

If using nvm:

```bash
echo 'export NODE_BINARY=$(. ~/.nvm/nvm.sh --no-use && nvm which 22)' > ios/.xcode.env.local
```

### CocoaPods version mismatch

Always use `npm run pods`, never bare `pod install`:

```bash
npm run pods          # correct — uses Gemfile.lock version
pod install           # wrong — uses system CocoaPods, may differ
```
