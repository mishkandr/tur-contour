#!/bin/sh
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Установите Node.js 22 или новее и запустите файл ещё раз.'
  exit 1
fi
export PORT="${PORT:-0}"
exec node server.mjs --open
