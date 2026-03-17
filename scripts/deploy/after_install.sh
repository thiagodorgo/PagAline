#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/srv/pagaline/current
SECRET_NAME="${APP_SECRET_NAME:-pagaline/prod/app-env}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TLS_DIR=/etc/pagaline/tls

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

install -d -m 0750 -o root -g root /etc/pagaline
install -d -m 0750 -o root -g root "$TLS_DIR"

if [[ ! -f "$TLS_DIR/server.crt" || ! -f "$TLS_DIR/server.key" ]]; then
  IMDS_TOKEN="$(curl -fsS -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" || true)"
  PUBLIC_IP="$(curl -fsS -H "X-aws-ec2-metadata-token: ${IMDS_TOKEN}" \
    http://169.254.169.254/latest/meta-data/public-ipv4 || true)"

  OPENSSL_CONFIG="$(mktemp)"
  cat > "$OPENSSL_CONFIG" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = ${PUBLIC_IP:-pagaline.local}

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
EOF

  if [[ -n "${PUBLIC_IP:-}" ]]; then
    cat >> "$OPENSSL_CONFIG" <<EOF
IP.2 = ${PUBLIC_IP}
EOF
  fi

  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$TLS_DIR/server.key" \
    -out "$TLS_DIR/server.crt" \
    -days 365 \
    -config "$OPENSSL_CONFIG"

  chmod 600 "$TLS_DIR/server.key"
  chmod 644 "$TLS_DIR/server.crt"
  rm -f "$OPENSSL_CONFIG"
fi

install -m 0644 deploy/systemd/pagaline.service /etc/systemd/system/pagaline.service
install -m 0644 deploy/nginx/pagaline.conf /etc/nginx/conf.d/pagaline.conf
rm -f /etc/nginx/conf.d/default.conf

sudo -u ec2-user bash -lc 'cd /srv/pagaline/current && npm ci'
sudo -u ec2-user bash -lc 'set -a && . /etc/pagaline.env && set +a && cd /srv/pagaline/current && npm run build'
sudo -u ec2-user bash -lc 'set -a && . /etc/pagaline.env && set +a && cd /srv/pagaline/current && npm run db:push'

systemctl daemon-reload
systemctl enable pagaline
nginx -t
systemctl enable nginx
