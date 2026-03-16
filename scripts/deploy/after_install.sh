#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/srv/pagaline/current
SECRET_NAME="${APP_SECRET_NAME:-pagaline/prod/app-env}"
AWS_REGION="${AWS_REGION:-us-east-1}"

cd "$APP_DIR"
chown -R ec2-user:ec2-user "$APP_DIR"

aws secretsmanager get-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$SECRET_NAME" \
  --query SecretString \
  --output text \
  | jq -r 'to_entries[] | "\(.key)=\(.value | tostring | @sh)"' \
  > /etc/pagaline.env

chown root:ec2-user /etc/pagaline.env
chmod 640 /etc/pagaline.env

install -m 0644 deploy/systemd/pagaline.service /etc/systemd/system/pagaline.service
install -m 0644 deploy/nginx/pagaline.conf /etc/nginx/conf.d/pagaline.conf
rm -f /etc/nginx/conf.d/default.conf

sudo -u ec2-user bash -lc 'cd /srv/pagaline/current && npm ci'
sudo -u ec2-user bash -lc 'cd /srv/pagaline/current && npm run build'
sudo -u ec2-user bash -lc 'set -a && . /etc/pagaline.env && set +a && cd /srv/pagaline/current && npm run db:push'

systemctl daemon-reload
systemctl enable pagaline
nginx -t
systemctl enable nginx
