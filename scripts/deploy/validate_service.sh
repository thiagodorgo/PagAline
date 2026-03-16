#!/usr/bin/env bash
set -euo pipefail

systemctl is-active --quiet pagaline
systemctl is-active --quiet nginx
curl -fsS http://127.0.0.1/ >/dev/null
