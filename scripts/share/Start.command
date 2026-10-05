#!/bin/bash
cd "$(dirname "$0")" || exit 1

ARCH="$(uname -m)"
case "$ARCH" in
  arm64)
    BIN="runtime/server-darwin-arm64"
    ;;
  x86_64)
    BIN="runtime/server-darwin-amd64"
    ;;
  *)
    echo "This Mac uses an unsupported processor ($ARCH). Use a Mac with Apple silicon or Intel."
    read -r -p "Press Return to close this window."
    exit 1
    ;;
esac

xattr -dr com.apple.quarantine runtime 2>/dev/null
chmod +x "$BIN"
"$BIN" --root app --open
STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  echo "The presenter stopped with an error."
  read -r -p "Press Return to close this window."
fi
exit "$STATUS"
