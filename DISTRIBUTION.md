# Distribution

How to ship Mesozoic Protocol to desktop (Tauri / Steam) and mobile (Capacitor / iOS / Android).

The web build is a static Vite bundle in `dist/`. Both shells just wrap that bundle:

- Tauri loads `dist/` inside a native WebView (Wry on macOS/Windows/Linux).
- Capacitor loads `dist/` inside iOS WKWebView or Android WebView.

So `pnpm build` always runs first; both shells then sync the result.

## Desktop (Tauri → Steam)

### One-time prerequisites

- Rust toolchain + Tauri prerequisites: <https://tauri.app/start/prerequisites/>
- macOS: Xcode Command Line Tools (already required for `xcodebuild`).
- Windows: WiX Toolset 3 (for `.msi`) and/or NSIS (for `.exe` installer). Tauri downloads both on first run.

### Build

```bash
pnpm tauri build
```

Outputs land in `src-tauri/target/release/bundle/`:

- macOS: `bundle/macos/Mesozoic Protocol.app` and `bundle/dmg/Mesozoic Protocol_<version>_<arch>.dmg`
- Windows: `bundle/msi/Mesozoic Protocol_<version>_x64_en-US.msi` and `bundle/nsis/Mesozoic Protocol_<version>_x64-setup.exe`
- Linux: `bundle/appimage/extinction-protocol_<version>_amd64.AppImage` and `bundle/deb/extinction-protocol_<version>_amd64.deb`

The bundle metadata (category=Game, copyright, publisher, descriptions, min system version) is in `src-tauri/tauri.conf.json` under `bundle.*`.

### Cross-compiling

Tauri bundles per host. To produce both macOS and Windows artifacts:

- Run `pnpm tauri build` on a Mac for `.app`/`.dmg`.
- Run `pnpm tauri build` on Windows (or a Windows VM / GitHub Actions runner) for `.msi`/`.exe`.

For CI, use the official `tauri-action`: <https://github.com/tauri-apps/tauri-action>.

### Code signing (optional but recommended)

Steam distributes through its own DRM and doesn't require notarization, but unsigned binaries trigger Gatekeeper / SmartScreen warnings if a user runs the bundle outside Steam.

- macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` env vars. See <https://tauri.app/distribute/sign/macos/>.
- Windows: `WINDOWS_CERTIFICATE` (base64 PFX) + `WINDOWS_CERTIFICATE_PASSWORD`. See <https://tauri.app/distribute/sign/windows/>.

### Steam upload

1. Get a Steam Direct app from <https://partner.steamgames.com> (one-time fee per app).
2. Install Steamworks SDK + `steamcmd`: <https://partner.steamgames.com/doc/sdk>.
3. Configure a depot per platform (macOS / Windows / Linux).
4. Build, then point your depot's `ContentRoot` at the platform-specific output:
   - macOS depot → `src-tauri/target/release/bundle/macos/Mesozoic Protocol.app/`
   - Windows depot → directory containing `extinction-protocol.exe` and any sibling DLLs/resources Tauri produced
   - Linux depot → AppImage or extracted runtime
5. Run `steamcmd +run_app_build <path-to-app_build_<appid>.vdf>` to upload.
6. Set the build live in the Steamworks dashboard.

### Optional: Steamworks SDK (achievements, overlay, cloud saves)

The current build is **Steam-shippable as-is** — Steam wraps any plain executable. To get achievements, the Steam overlay, friends list, or cloud saves you'd add the SDK. This is optional and requires a real Steam App ID. Sketch:

1. Add `steamworks = "0.11"` to `src-tauri/Cargo.toml` and download the proprietary SDK (`STEAM_SDK_LOCATION` env var).
2. In `src-tauri/src/lib.rs`, init `steamworks::Client::init_app(<APP_ID>)` in the Tauri `setup` hook and expose Tauri commands for achievement / cloud-save calls.
3. Add a `steam_appid.txt` (single line: the app ID) next to the executable so the SDK can attach when you launch outside Steam during dev. **Do not commit this file** — add it to `src-tauri/.gitignore`.
4. From the renderer, invoke commands via `@tauri-apps/api`'s `invoke()`. Map game events (level cleared, achievement earned, save-slot updated) to Steamworks calls.

Until then, the game saves locally via the existing Zustand persistence layer and posts no telemetry to Steam — fine for soft launch.

## Mobile (Capacitor → iOS / Android)

Capacitor bundles the Vite build inside a native shell. No RN rewrite, no Expo. The web app already handles touch input, fullscreen, landscape detection, and responsive panels (see notes items 10, 11, 13).

### One-time prerequisites

- iOS: Xcode 15+, an Apple Developer account ($99/yr) for App Store distribution. CocoaPods is **not** required — Capacitor 8 uses Swift Package Manager.
- Android: JDK 17+ and Android Studio (or just the Android SDK + `gradle`). Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) to the SDK directory.

The first time you sync on a new machine, install the Android SDK platform tools through Android Studio's SDK Manager.

### Day-to-day workflow

```bash
# Build the web bundle and copy it into ios/ + android/
pnpm build && npx cap sync

# Open the native project in its IDE, then Run / Archive from there.
npx cap open ios
npx cap open android
```

Common subcommands:

- `npx cap copy ios|android` — copy `dist/` into the platform without re-installing native plugins (faster than `sync`).
- `npx cap sync ios|android` — copy + reinstall plugins (use after adding a Capacitor plugin).
- `npx cap run ios --target=<udid>` / `npx cap run android` — build + launch on a device/emulator from the CLI.

### iOS distribution

1. In Xcode, set the bundle's Team to your Apple Developer team (Signing & Capabilities tab).
2. Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj` (or via Xcode's General tab).
3. Product → Archive → Distribute App → App Store Connect (TestFlight or Release).

Bundle ID is `com.extinctionprotocol.app` (matches the Tauri identifier — keep them in sync).

### Android distribution

1. Generate a signing keystore (one-time): `keytool -genkey -v -keystore extinction-protocol.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`.
2. In `android/app/build.gradle`, configure `signingConfigs.release` to point at the keystore (use `gradle.properties` or env vars; keystore + passwords must NOT be committed).
3. `cd android && ./gradlew bundleRelease` produces `android/app/build/outputs/bundle/release/app-release.aab` for Play Console upload.
4. For sideload-friendly APKs use `./gradlew assembleRelease` instead.

Or do everything from Android Studio: Build → Generate Signed Bundle / APK.

### Mobile-specific notes

- The web build uses `localStorage` for save data; that survives WebView reloads but **not** OS-level uninstall on iOS (iOS clears WebView storage on reinstall). If save persistence across reinstalls matters, swap to `@capacitor/preferences` and adapt the `progress.ts` / save-slot layer.
- Plausible analytics defaults to `protocol.trebeljahr.com` and the self-hosted script at `https://plausible.trebeljahr.com`. The loader and event wrapper both require the current hostname to match `VITE_PLAUSIBLE_DOMAIN`, so local previews and mobile/native shells stay silent.
- iOS Info.plist (`ios/App/App/Info.plist`) supports portrait + both landscapes by default. Edit `UISupportedInterfaceOrientations` to landscape-only if desired.
- Android manifest (`android/app/src/main/AndroidManifest.xml`) already has `INTERNET` permission for analytics. Add no others unless required by future plugins.

### Updating the app

The pipeline for shipping a new version is:

```bash
# 1. Bump version in package.json AND src-tauri/tauri.conf.json AND iOS/Android project files.
# 2. Build everything.
pnpm build
pnpm tauri build              # desktop installers
npx cap sync                   # mobile

# 3. Distribute.
# Desktop:  upload to Steam depot (steamcmd) or to your download host.
# iOS:      Xcode → Archive → Distribute → App Store Connect.
# Android:  ./gradlew bundleRelease → Play Console upload.
```
