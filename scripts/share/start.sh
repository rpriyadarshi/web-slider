#!/bin/sh
cd "$(dirname "$0")" || exit 1

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64)
    BIN="runtime/server-linux-amd64"
    ;;
  *)
    echo "This Linux system uses an unsupported processor ($ARCH). Use a PC with x86_64 (amd64)."
    exit 1
    ;;
esac

chmod +x "$BIN"
exec "$BIN" --root app --open
