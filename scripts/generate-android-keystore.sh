#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# generate-android-keystore.sh
#
# Generates a release keystore for the Meet Serenity Android app and prints
# the base64-encoded values you need to add as GitHub Actions secrets.
#
# Usage:
#   chmod +x scripts/generate-android-keystore.sh
#   ./scripts/generate-android-keystore.sh
#
# Requirements:
#   - Java / keytool must be installed (comes with any JDK)
#   - Run this ONCE, store the generated .keystore file safely offline
#   - Never commit the .keystore file to git
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

KEYSTORE_FILE="meetserenity-release.keystore"
KEY_ALIAS="meetserenity"
VALIDITY_DAYS=10000   # ~27 years

echo ""
echo "============================================================"
echo "  Meet Serenity — Android Release Keystore Generator"
echo "============================================================"
echo ""
echo "You will be prompted to enter passwords and certificate info."
echo "Use strong, unique passwords and save them somewhere safe"
echo "(e.g. a password manager)."
echo ""

# Prompt for passwords
read -rsp "Enter KEYSTORE password (min 6 chars): " KEYSTORE_PASSWORD
echo ""
read -rsp "Confirm KEYSTORE password: " KEYSTORE_PASSWORD_CONFIRM
echo ""
if [ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD_CONFIRM" ]; then
  echo "ERROR: Passwords do not match." >&2
  exit 1
fi

read -rsp "Enter KEY password (can be same as keystore password): " KEY_PASSWORD
echo ""
read -rsp "Confirm KEY password: " KEY_PASSWORD_CONFIRM
echo ""
if [ "$KEY_PASSWORD" != "$KEY_PASSWORD_CONFIRM" ]; then
  echo "ERROR: Passwords do not match." >&2
  exit 1
fi

echo ""
echo "Generating keystore: $KEYSTORE_FILE"
echo "(You will be prompted for your name/org details)"
echo ""

keytool -genkey \
  -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY_DAYS" \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD"

echo ""
echo "============================================================"
echo "  Keystore generated successfully: $KEYSTORE_FILE"
echo "============================================================"
echo ""
echo "Now encoding to base64 for GitHub secrets..."
echo ""

KEYSTORE_B64=$(base64 -w 0 "$KEYSTORE_FILE" 2>/dev/null || base64 "$KEYSTORE_FILE")

echo "────────────────────────────────────────────────────────────"
echo "Add these to: GitHub → Settings → Secrets and variables → Actions"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "Secret name:  ANDROID_KEYSTORE_BASE64"
echo "Secret value: $KEYSTORE_B64"
echo ""
echo "Secret name:  ANDROID_KEYSTORE_PASSWORD"
echo "Secret value: $KEYSTORE_PASSWORD"
echo ""
echo "Secret name:  ANDROID_KEY_PASSWORD"
echo "Secret value: $KEY_PASSWORD"
echo ""
echo "────────────────────────────────────────────────────────────"
echo "Add this to: GitHub → Settings → Secrets and variables → Variables"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "Variable name:  ANDROID_KEY_ALIAS"
echo "Variable value: $KEY_ALIAS"
echo ""
echo "============================================================"
echo "  IMPORTANT — store $KEYSTORE_FILE somewhere safe offline"
echo "  If you lose it you CANNOT update your app on the Play Store"
echo "  Do NOT commit it to git"
echo "============================================================"
echo ""
