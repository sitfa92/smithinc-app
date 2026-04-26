# App Store & Play Store Setup Guide

This document walks through every step needed to get the GitHub Actions workflows building and deploying the Meet Serenity app to both stores.

---

## Android — Google Play Store

### Step 1 — Generate a release keystore

Run the helper script (requires JDK installed):

```bash
chmod +x scripts/generate-android-keystore.sh
./scripts/generate-android-keystore.sh
```

The script will:
- Prompt you for passwords
- Generate `meetserenity-release.keystore`
- Print the exact GitHub secret values to copy-paste

> **Critical:** Store the `.keystore` file somewhere safe (not in git). If you lose it you can never update the app on Play Store.

### Step 2 — Add GitHub secrets

Go to **GitHub → your repo → Settings → Secrets and variables → Actions**.

Add these **Secrets**:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Output from the script |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password you chose |
| `ANDROID_KEY_PASSWORD` | The key password you chose |

Add this **Variable** (under the Variables tab):

| Variable name | Value |
|---|---|
| `ANDROID_KEY_ALIAS` | `meetserenity` |

### Step 3 — Set up Google Play service account

To upload to the Play Store automatically:

1. Go to [Google Play Console](https://play.google.com/console) → Setup → API access
2. Link to a Google Cloud project and create a service account with **Release Manager** role
3. Download the JSON key for that service account
4. Add it as a GitHub secret:

| Secret name | Value |
|---|---|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The full contents of the downloaded JSON file |

---

## iOS — Apple App Store

iOS requires a paid Apple Developer account ($99/year). Steps:

### Step 1 — Create an App Store distribution certificate

1. Open **Xcode → Settings → Accounts** and sign in with your Apple ID
2. Click **Manage Certificates** → click **+** → choose **Apple Distribution**
3. Right-click the new certificate → **Export Certificate** → save as `.p12` with a password
4. Encode it: `base64 -w 0 certificate.p12` (Linux) or `base64 certificate.p12` (macOS)

Add GitHub secrets:

| Secret name | Value |
|---|---|
| `IOS_CERTIFICATE_P12_BASE64` | The base64 output from above |
| `IOS_CERTIFICATE_PASSWORD` | The password you set on the `.p12` |

### Step 2 — Create a provisioning profile

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/profiles/list)
2. Create a new **App Store** distribution profile for bundle ID `online.meetserenity.app`
3. Download the `.mobileprovision` file
4. Encode it: `base64 -w 0 profile.mobileprovision` (Linux) or `base64 profile.mobileprovision` (macOS)

Add GitHub secrets/variables:

| Name | Type | Value |
|---|---|---|
| `IOS_PROVISIONING_PROFILE_BASE64` | Secret | The base64 output from above |
| `IOS_PROVISIONING_PROFILE_NAME` | Variable | The profile name from the portal |
| `APPLE_TEAM_ID` | Variable | Your 10-character Team ID (found at developer.apple.com/account) |

### Step 3 — Create an App Store Connect API key

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → Users and Access → Integrations → App Store Connect API
2. Click **+** to generate a new key with **App Manager** role
3. Download the `.p8` file (you can only download it once)
4. Note the **Key ID** and **Issuer ID** shown on the page
5. Encode the key: `base64 -w 0 AuthKey_XXXXX.p8`

Add GitHub secrets:

| Secret name | Value |
|---|---|
| `ASC_API_KEY_ID` | The Key ID from the portal |
| `ASC_ISSUER_ID` | The Issuer ID from the portal |
| `ASC_API_KEY_P8_BASE64` | The base64-encoded `.p8` file |

---

## Supabase (already working ✅)

These secrets are already set and the web build succeeds:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Triggering a build

Once all secrets are set, push to `main` to trigger both workflows automatically.

You can also trigger manually: **GitHub → Actions → choose workflow → Run workflow**.

To upload to the stores on a manual run, check the **"Upload to store?"** checkbox.
