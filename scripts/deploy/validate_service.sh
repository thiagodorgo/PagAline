#!/usr/bin/env bash
set -euo pipefail

systemctl is-active --quiet pagaline
systemctl is-active --quiet nginx

for _ in $(seq 1 15); do
  if curl -kfsS https://127.0.0.1/health >/dev/null; then
    exit 0
  fi
  sleep 2
done

exit 1
