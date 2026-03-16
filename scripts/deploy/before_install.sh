#!/usr/bin/env bash
set -euo pipefail

install -d -o ec2-user -g ec2-user /srv/pagaline/current

if systemctl list-unit-files | grep -q '^pagaline\.service'; then
  systemctl stop pagaline || true
fi
