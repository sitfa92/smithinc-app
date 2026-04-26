# Android Play Store Setup

This project already has Capacitor Android wired. Use this checklist to finish Play Store readiness and release safely.

## 1) One-time Play Console setup

1. Create app in Google Play Console with package name: `online.meetserenity.app`.
2. Complete Store Listing, Content Rating, App Access, Data Safety, and Privacy Policy.
3. Enable Play App Signing (recommended).
4. Create a Service Account in Google Cloud and grant Play Console access:
   - Play Console -> Setup -> API access -> link project -> grant release permissions.
5. Download service account JSON and store it as GitHub secret:
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

## 2) One-time signing setup

Generate an upload keystore (local machine):

```bash
keytool -genkeypair \
  -v \
  -storetype JKS \
  -keystore release.keystore \
  -alias meetserenity \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Add GitHub secrets/vars:

- Secret: `ANDROID_KEYSTORE_BASE64`
  - `base64 -i release.keystore | tr -d '\n'`
- Secret: `ANDROID_KEYSTORE_PASSWORD`
- Secret: `ANDROID_KEY_PASSWORD`
- Variable: `ANDROID_KEY_ALIAS` (example: `meetserenity`)

Never commit `.keystore` or `.jks` files.

## 3) CI workflow behavior (already configured)

- Push to `main`: builds signed AAB and uploads artifact only.
- Manual dispatch (`Android — Build & Deploy to Play Store`):
  - Optional upload to Play when `upload_to_store=true`
  - Choose `track` and `release_status`
  - Optionally set `version_code` and `version_name`

## 4) Versioning rules

- `versionCode` must increase for every Play upload.
- `versionName` is display version (example: `1.0.2`).
- You can pass these in workflow dispatch inputs.

## 5) Recommended release flow

1. Run workflow manually with:
   - `upload_to_store=false`
   - `version_code=<next integer>`
   - `version_name=<x.y.z>`
2. Install/test AAB internally.
3. Re-run workflow with:
   - `upload_to_store=true`
   - `track=internal`
   - `release_status=draft`
4. Validate in Play Console internal testing.
5. Promote to broader track when ready.

## 6) Local debug commands

```bash
npm run build
npx cap sync android
cd android && ./gradlew bundleRelease
```

If local release build fails, verify Java 17 and Android SDK are installed.

## 7) Important note for web content mode

`capacitor.config.json` currently has:

- `server.url = https://meet-serenity.online`

This means the app loads remote web content at runtime. For stricter native packaging, remove `server.url` so bundled `dist` assets are used.
