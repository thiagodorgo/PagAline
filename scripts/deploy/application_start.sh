#!/usr/bin/env bash
set -euo pipefail

systemctl restart pagaline
systemctl restart nginx
