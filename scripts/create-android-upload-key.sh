#!/usr/bin/env bash
# One-time: create the Android upload key and store it as GitHub Actions secrets.
#
# The password is generated here and never printed. The keystore and password are also
# written to ~/.yallist-keys/ — back both up to your password manager, then you may delete
# that folder. Losing the upload key is recoverable (Play support can reset it), but slow.
set -euo pipefail

REPO="nadavgihasi/yallist"
DIR="$HOME/.yallist-keys"
ALIAS="upload"

if [[ -e "$DIR/upload.p12" ]]; then
  echo "Refusing to overwrite existing $DIR/upload.p12" >&2
  exit 1
fi

mkdir -p "$DIR"
chmod 700 "$DIR"
umask 077

PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')"
printf '%s' "$PASSWORD" > "$DIR/upload-password.txt"

# PKCS12 keystore, RSA 2048, valid ~30 years (Play requires validity past 2033).
openssl req -x509 -newkey rsa:2048 -nodes -days 10950 \
  -subj "/CN=Yallist upload key" \
  -keyout "$DIR/upload-key.pem" -out "$DIR/upload-cert.pem" 2>/dev/null
openssl pkcs12 -export -name "$ALIAS" \
  -inkey "$DIR/upload-key.pem" -in "$DIR/upload-cert.pem" \
  -out "$DIR/upload.p12" -passout "pass:$PASSWORD"
rm "$DIR/upload-key.pem"

base64 < "$DIR/upload.p12" | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO"
printf '%s' "$PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS --repo "$REPO"

echo "Done. Upload key: $DIR/upload.p12 (password in $DIR/upload-password.txt)."
echo "Certificate SHA-256 (Play Console shows this as the upload key fingerprint):"
openssl x509 -in "$DIR/upload-cert.pem" -noout -fingerprint -sha256
