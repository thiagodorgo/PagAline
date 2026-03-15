#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Command not found: $1"
}

prompt_default() {
  local prompt="$1"
  local default_value="$2"
  local value
  read -r -p "$prompt [$default_value]: " value
  printf '%s' "${value:-$default_value}"
}

resource_exists() {
  local value="$1"
  [[ -n "$value" && "$value" != "None" && "$value" != "null" ]]
}

require_cmd aws
require_cmd python3

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || true)}}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_REGION="$(prompt_default 'AWS region' "$AWS_REGION")"
export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
CALLER_ARN="$(aws sts get-caller-identity --query 'Arn' --output text)"

log "AWS account: $ACCOUNT_ID"
log "Caller ARN: $CALLER_ARN"

DEFAULT_PREFIX="pagaline"
APP_PREFIX_RAW="$(prompt_default 'Project prefix (used in resource names)' "$DEFAULT_PREFIX")"
APP_PREFIX="$(printf '%s' "$APP_PREFIX_RAW" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//; s/--+/-/g')"
[[ ${#APP_PREFIX} -ge 4 ]] || fail "Project prefix must resolve to at least 4 characters."

DEFAULT_REPO_URL="https://github.com/REPLACE_ME/PagAline"
GITHUB_REPOSITORY_URL="$(prompt_default 'GitHub repository URL' "${GITHUB_REPOSITORY_URL:-$DEFAULT_REPO_URL}")"
[[ "$GITHUB_REPOSITORY_URL" == https://github.com/* ]] || fail "GitHub repository URL must start with https://github.com/"
GITHUB_BRANCH="$(prompt_default 'GitHub branch' "${GITHUB_BRANCH:-main}")"

DB_NAME="$(prompt_default 'Database name' "${DB_NAME:-pagaline}")"
DB_USERNAME="$(prompt_default 'Database username' "${DB_USERNAME:-pagaline_app}")"
DB_INSTANCE_CLASS="$(prompt_default 'RDS instance class' "${DB_INSTANCE_CLASS:-db.t3.micro}")"

DEFAULT_ALLOWED_CIDR=""
if command -v curl >/dev/null 2>&1; then
  DETECTED_IP="$(curl -fsS https://checkip.amazonaws.com 2>/dev/null || true)"
  if [[ "$DETECTED_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    DEFAULT_ALLOWED_CIDR="${DETECTED_IP}/32"
  fi
fi
if [[ -n "${ALLOWED_CIDR:-}" ]]; then
  ALLOWED_CIDR_INPUT="$ALLOWED_CIDR"
elif [[ -n "$DEFAULT_ALLOWED_CIDR" ]]; then
  ALLOWED_CIDR_INPUT="$(prompt_default 'CIDR allowed to reach PostgreSQL for bootstrap' "$DEFAULT_ALLOWED_CIDR")"
else
  read -r -p "CIDR allowed to reach PostgreSQL for bootstrap (example 203.0.113.10/32): " ALLOWED_CIDR_INPUT
fi
ALLOWED_CIDR="${ALLOWED_CIDR_INPUT:-}"
[[ -n "$ALLOWED_CIDR" ]] || fail "ALLOWED_CIDR is required."

read -r -s -p "Database password: " DB_PASSWORD
printf '\n'
read -r -s -p "Confirm database password: " DB_PASSWORD_CONFIRM
printf '\n'
[[ "$DB_PASSWORD" == "$DB_PASSWORD_CONFIRM" ]] || fail "Passwords do not match."
[[ -n "$DB_PASSWORD" ]] || fail "Database password cannot be empty."

SERVICE_NAME="${SERVICE_NAME:-$APP_PREFIX}"
CONNECTION_NAME="${CONNECTION_NAME:-${APP_PREFIX}-github}"
VPC_NAME="${APP_PREFIX}-vpc"
IGW_NAME="${APP_PREFIX}-igw"
PUBLIC_RT_NAME="${APP_PREFIX}-public-rt"
PRIVATE_RT_NAME="${APP_PREFIX}-private-rt"
PUBLIC_SUBNET1_NAME="${APP_PREFIX}-public-a"
PUBLIC_SUBNET2_NAME="${APP_PREFIX}-public-b"
PRIVATE_SUBNET1_NAME="${APP_PREFIX}-private-a"
PRIVATE_SUBNET2_NAME="${APP_PREFIX}-private-b"
DB_SUBNET_GROUP_NAME="${APP_PREFIX}-db-subnet-group"
DB_IDENTIFIER="${APP_PREFIX}-db"
DB_SG_NAME="${APP_PREFIX}-rds-sg"
APP_SG_NAME="${APP_PREFIX}-apprunner-sg"
SECRET_NAME="${APP_PREFIX}/prod/database-url"
INSTANCE_ROLE_NAME="${APP_PREFIX}-apprunner-instance-role"
INSTANCE_POLICY_NAME="${APP_PREFIX}-apprunner-secret-access"
VPC_CONNECTOR_NAME="${APP_PREFIX}-vpc-connector"
OUTPUT_FILE="${APP_PREFIX}-aws-output.json"

EXISTING_SERVICE_ARN="$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" --output text)"
if resource_exists "$EXISTING_SERVICE_ARN"; then
  fail "An App Runner service named ${SERVICE_NAME} already exists: ${EXISTING_SERVICE_ARN}"
fi

EXISTING_DB_ARN="$(aws rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" --query 'DBInstances[0].DBInstanceArn' --output text 2>/dev/null || true)"
if resource_exists "$EXISTING_DB_ARN"; then
  fail "An RDS instance named ${DB_IDENTIFIER} already exists: ${EXISTING_DB_ARN}"
fi

AZS_TEXT="$(aws ec2 describe-availability-zones --filters Name=state,Values=available --query 'AvailabilityZones[:2].ZoneName' --output text)"
read -r AZ1 AZ2 <<<"$AZS_TEXT"
[[ -n "${AZ1:-}" && -n "${AZ2:-}" ]] || fail "Could not resolve two Availability Zones in ${AWS_REGION}."

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

TRUST_POLICY_FILE="$TMP_DIR/trust-policy.json"
cat >"$TRUST_POLICY_FILE" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "tasks.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

log "Creating VPC and subnets"
VPC_ID="$(aws ec2 create-vpc \
  --cidr-block 10.42.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${VPC_NAME}},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'Vpc.VpcId' \
  --output text)"

aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support '{"Value":true}'
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames '{"Value":true}'

IGW_ID="$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${IGW_NAME}},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)"
aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID"

PUBLIC_SUBNET1_ID="$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block 10.42.0.0/24 \
  --availability-zone "$AZ1" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PUBLIC_SUBNET1_NAME}},{Key=Tier,Value=public},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'Subnet.SubnetId' \
  --output text)"

PUBLIC_SUBNET2_ID="$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block 10.42.1.0/24 \
  --availability-zone "$AZ2" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PUBLIC_SUBNET2_NAME}},{Key=Tier,Value=public},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'Subnet.SubnetId' \
  --output text)"

PRIVATE_SUBNET1_ID="$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block 10.42.10.0/24 \
  --availability-zone "$AZ1" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PRIVATE_SUBNET1_NAME}},{Key=Tier,Value=private},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'Subnet.SubnetId' \
  --output text)"

PRIVATE_SUBNET2_ID="$(aws ec2 create-subnet \
  --vpc-id "$VPC_ID" \
  --cidr-block 10.42.11.0/24 \
  --availability-zone "$AZ2" \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PRIVATE_SUBNET2_NAME}},{Key=Tier,Value=private},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'Subnet.SubnetId' \
  --output text)"

aws ec2 modify-subnet-attribute --subnet-id "$PUBLIC_SUBNET1_ID" --map-public-ip-on-launch
aws ec2 modify-subnet-attribute --subnet-id "$PUBLIC_SUBNET2_ID" --map-public-ip-on-launch

PUBLIC_RT_ID="$(aws ec2 create-route-table \
  --vpc-id "$VPC_ID" \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PUBLIC_RT_NAME}},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)"
aws ec2 create-route --route-table-id "$PUBLIC_RT_ID" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW_ID" >/dev/null
aws ec2 associate-route-table --route-table-id "$PUBLIC_RT_ID" --subnet-id "$PUBLIC_SUBNET1_ID" >/dev/null
aws ec2 associate-route-table --route-table-id "$PUBLIC_RT_ID" --subnet-id "$PUBLIC_SUBNET2_ID" >/dev/null

PRIVATE_RT_ID="$(aws ec2 create-route-table \
  --vpc-id "$VPC_ID" \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PRIVATE_RT_NAME}},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'RouteTable.RouteTableId' \
  --output text)"
aws ec2 associate-route-table --route-table-id "$PRIVATE_RT_ID" --subnet-id "$PRIVATE_SUBNET1_ID" >/dev/null
aws ec2 associate-route-table --route-table-id "$PRIVATE_RT_ID" --subnet-id "$PRIVATE_SUBNET2_ID" >/dev/null

log "Creating security groups"
DB_SG_ID="$(aws ec2 create-security-group \
  --group-name "$DB_SG_NAME" \
  --description "PagAline PostgreSQL access" \
  --vpc-id "$VPC_ID" \
  --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${DB_SG_NAME}},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'GroupId' \
  --output text)"

APP_SG_ID="$(aws ec2 create-security-group \
  --group-name "$APP_SG_NAME" \
  --description "PagAline App Runner VPC connector egress" \
  --vpc-id "$VPC_ID" \
  --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${APP_SG_NAME}},{Key=Project,Value=${APP_PREFIX}}]" \
  --query 'GroupId' \
  --output text)"

aws ec2 authorize-security-group-ingress \
  --group-id "$DB_SG_ID" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":5432,\"ToPort\":5432,\"IpRanges\":[{\"CidrIp\":\"${ALLOWED_CIDR}\",\"Description\":\"Bootstrap access\"}]}]" >/dev/null

aws ec2 authorize-security-group-ingress \
  --group-id "$DB_SG_ID" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":5432,\"ToPort\":5432,\"UserIdGroupPairs\":[{\"GroupId\":\"${APP_SG_ID}\",\"Description\":\"App Runner to PostgreSQL\"}]}]" >/dev/null

log "Creating DB subnet group"
aws rds create-db-subnet-group \
  --db-subnet-group-name "$DB_SUBNET_GROUP_NAME" \
  --db-subnet-group-description "PagAline PostgreSQL subnet group" \
  --subnet-ids "$PUBLIC_SUBNET1_ID" "$PUBLIC_SUBNET2_ID" \
  --tags "Key=Name,Value=${DB_SUBNET_GROUP_NAME}" "Key=Project,Value=${APP_PREFIX}" >/dev/null

log "Creating PostgreSQL instance (this takes several minutes)"
aws rds create-db-instance \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --engine postgres \
  --db-instance-class "$DB_INSTANCE_CLASS" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --db-name "$DB_NAME" \
  --master-username "$DB_USERNAME" \
  --master-user-password "$DB_PASSWORD" \
  --port 5432 \
  --backup-retention-period 7 \
  --db-subnet-group-name "$DB_SUBNET_GROUP_NAME" \
  --vpc-security-group-ids "$DB_SG_ID" \
  --publicly-accessible \
  --no-multi-az \
  --tags "Key=Name,Value=${DB_IDENTIFIER}" "Key=Project,Value=${APP_PREFIX}" >/dev/null

aws rds wait db-instance-available --db-instance-identifier "$DB_IDENTIFIER"

DB_ENDPOINT="$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)"

resource_exists "$DB_ENDPOINT" || fail "RDS endpoint not available."

ENCODED_USERNAME="$(python3 - "$DB_USERNAME" <<'PY'
import sys
from urllib.parse import quote
print(quote(sys.argv[1], safe=""))
PY
)"

ENCODED_PASSWORD="$(python3 - "$DB_PASSWORD" <<'PY'
import sys
from urllib.parse import quote
print(quote(sys.argv[1], safe=""))
PY
)"

ENCODED_DB_NAME="$(python3 - "$DB_NAME" <<'PY'
import sys
from urllib.parse import quote
print(quote(sys.argv[1], safe=""))
PY
)"

DATABASE_URL="postgresql://${ENCODED_USERNAME}:${ENCODED_PASSWORD}@${DB_ENDPOINT}:5432/${ENCODED_DB_NAME}"

log "Creating or updating Secrets Manager secret"
SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --query 'ARN' --output text 2>/dev/null || true)"
if resource_exists "$SECRET_ARN"; then
  aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "$DATABASE_URL" >/dev/null
else
  SECRET_ARN="$(aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "PagAline production DATABASE_URL" \
    --secret-string "$DATABASE_URL" \
    --query 'ARN' \
    --output text)"
fi

log "Bootstrapping PostgreSQL schema"
if ! python3 - <<'PY' >/dev/null 2>&1
import importlib.util
import sys
sys.exit(0 if importlib.util.find_spec("psycopg") else 1)
PY
then
  python3 -m pip install --user --quiet "psycopg[binary]>=3.1,<4"
fi

python3 - "$DATABASE_URL" <<'PY'
import sys
import time
import psycopg

database_url = sys.argv[1]
sql = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bills (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  description text NOT NULL,
  amount double precision NOT NULL,
  due_date timestamp NOT NULL,
  category text NOT NULL DEFAULT 'Outros',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  image_url text,
  paid_date timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS settings (
  id varchar PRIMARY KEY DEFAULT 'default',
  user_name text NOT NULL DEFAULT 'Aline Silva',
  user_plan text NOT NULL DEFAULT 'Plano Premium',
  custom_photo_url text,
  monthly_goal double precision NOT NULL DEFAULT 5000
);

INSERT INTO settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (name)
VALUES
  ('Casa'),
  ('Transporte'),
  ('Educação'),
  ('Saúde'),
  ('Lazer'),
  ('Impostos'),
  ('Outros')
ON CONFLICT (name) DO NOTHING;
"""

last_error = None
for _ in range(30):
  try:
    with psycopg.connect(database_url, autocommit=True) as conn:
      with conn.cursor() as cur:
        cur.execute(sql)
      break
  except Exception as exc:  # pragma: no cover - bootstrap retry path
    last_error = exc
    time.sleep(10)
else:
  raise SystemExit(f"Schema bootstrap failed after retries: {last_error}")
PY

log "Creating or reusing App Runner GitHub connection"
CONNECTION_ARN="$(aws apprunner list-connections \
  --connection-name "$CONNECTION_NAME" \
  --query 'ConnectionSummaryList[0].ConnectionArn' \
  --output text 2>/dev/null || true)"
CONNECTION_STATUS="$(aws apprunner list-connections \
  --connection-name "$CONNECTION_NAME" \
  --query 'ConnectionSummaryList[0].Status' \
  --output text 2>/dev/null || true)"

if ! resource_exists "$CONNECTION_ARN"; then
  CONNECTION_ARN="$(aws apprunner create-connection \
    --connection-name "$CONNECTION_NAME" \
    --provider-type GITHUB \
    --query 'Connection.ConnectionArn' \
    --output text)"
  CONNECTION_STATUS="PENDING_HANDSHAKE"
fi

if [[ "$CONNECTION_STATUS" == "PENDING_HANDSHAKE" ]]; then
  printf '\nManual action required by AWS:\n'
  printf '1. Open this URL in another browser tab:\n'
  printf '   https://console.aws.amazon.com/apprunner/home?region=%s#/connections\n' "$AWS_REGION"
  printf '2. Complete the GitHub handshake for the connection named: %s\n' "$CONNECTION_NAME"
  printf '3. Return here and press Enter.\n\n'
  read -r -p "Press Enter after the GitHub handshake is complete..."
fi

for _ in {1..90}; do
  CONNECTION_STATUS="$(aws apprunner list-connections \
    --connection-name "$CONNECTION_NAME" \
    --query 'ConnectionSummaryList[0].Status' \
    --output text)"
  if [[ "$CONNECTION_STATUS" == "AVAILABLE" ]]; then
    break
  fi
  if [[ "$CONNECTION_STATUS" == "ERROR" || "$CONNECTION_STATUS" == "DELETED" ]]; then
    fail "App Runner connection is in status ${CONNECTION_STATUS}."
  fi
  sleep 10
done

[[ "$CONNECTION_STATUS" == "AVAILABLE" ]] || fail "Timed out waiting for App Runner GitHub connection to become AVAILABLE."

log "Creating or updating App Runner instance role for secret access"
INSTANCE_ROLE_ARN="$(aws iam get-role --role-name "$INSTANCE_ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || true)"
if ! resource_exists "$INSTANCE_ROLE_ARN"; then
  INSTANCE_ROLE_ARN="$(aws iam create-role \
    --role-name "$INSTANCE_ROLE_NAME" \
    --assume-role-policy-document "file://${TRUST_POLICY_FILE}" \
    --query 'Role.Arn' \
    --output text)"
fi

ROLE_POLICY_FILE="$TMP_DIR/instance-role-policy.json"
cat >"$ROLE_POLICY_FILE" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadDatabaseUrlSecret",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "${SECRET_ARN}"
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name "$INSTANCE_ROLE_NAME" \
  --policy-name "$INSTANCE_POLICY_NAME" \
  --policy-document "file://${ROLE_POLICY_FILE}" >/dev/null

sleep 10

log "Creating or reusing App Runner VPC connector"
VPC_CONNECTOR_ARN="$(aws apprunner list-vpc-connectors \
  --query "VpcConnectors[?VpcConnectorName=='${VPC_CONNECTOR_NAME}'].VpcConnectorArn | [0]" \
  --output text)"

if ! resource_exists "$VPC_CONNECTOR_ARN"; then
  VPC_CONNECTOR_ARN="$(aws apprunner create-vpc-connector \
    --vpc-connector-name "$VPC_CONNECTOR_NAME" \
    --subnets "$PRIVATE_SUBNET1_ID" "$PRIVATE_SUBNET2_ID" \
    --security-groups "$APP_SG_ID" \
    --query 'VpcConnector.VpcConnectorArn' \
    --output text)"
fi

for _ in {1..60}; do
  VPC_CONNECTOR_STATUS="$(aws apprunner describe-vpc-connector \
    --vpc-connector-arn "$VPC_CONNECTOR_ARN" \
    --query 'VpcConnector.Status' \
    --output text)"
  if [[ "$VPC_CONNECTOR_STATUS" == "ACTIVE" ]]; then
    break
  fi
  sleep 10
done

[[ "$VPC_CONNECTOR_STATUS" == "ACTIVE" ]] || fail "Timed out waiting for VPC connector to become ACTIVE."

log "Creating App Runner service"
SERVICE_JSON_FILE="$TMP_DIR/apprunner-service.json"
python3 - "$SERVICE_JSON_FILE" "$SERVICE_NAME" "$CONNECTION_ARN" "$GITHUB_REPOSITORY_URL" "$GITHUB_BRANCH" "$SECRET_ARN" "$INSTANCE_ROLE_ARN" "$VPC_CONNECTOR_ARN" <<'PY'
import json
import sys

output_file, service_name, connection_arn, repo_url, branch, secret_arn, role_arn, connector_arn = sys.argv[1:]

payload = {
    "ServiceName": service_name,
    "SourceConfiguration": {
        "AuthenticationConfiguration": {
            "ConnectionArn": connection_arn
        },
        "AutoDeploymentsEnabled": True,
        "CodeRepository": {
            "RepositoryUrl": repo_url,
            "SourceCodeVersion": {
                "Type": "BRANCH",
                "Value": branch
            },
            "CodeConfiguration": {
                "ConfigurationSource": "API",
                "CodeConfigurationValues": {
                    "Runtime": "NODEJS_22",
                    "BuildCommand": "npm ci && npm run build",
                    "StartCommand": "npm start",
                    "Port": "8080",
                    "RuntimeEnvironmentVariables": {
                        "NODE_ENV": "production"
                    },
                    "RuntimeEnvironmentSecrets": {
                        "DATABASE_URL": secret_arn
                    }
                }
            }
        }
    },
    "InstanceConfiguration": {
        "Cpu": "1 vCPU",
        "Memory": "2 GB",
        "InstanceRoleArn": role_arn
    },
    "NetworkConfiguration": {
        "EgressConfiguration": {
            "EgressType": "VPC",
            "VpcConnectorArn": connector_arn
        },
        "IngressConfiguration": {
            "IsPubliclyAccessible": True
        },
        "IpAddressType": "IPV4"
    },
    "HealthCheckConfiguration": {
        "Protocol": "HTTP",
        "Path": "/",
        "Interval": 10,
        "Timeout": 5,
        "HealthyThreshold": 1,
        "UnhealthyThreshold": 5
    }
}

with open(output_file, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
PY

SERVICE_ARN="$(aws apprunner create-service \
  --cli-input-json "file://${SERVICE_JSON_FILE}" \
  --query 'Service.ServiceArn' \
  --output text)"

for _ in {1..90}; do
  SERVICE_STATUS="$(aws apprunner describe-service \
    --service-arn "$SERVICE_ARN" \
    --query 'Service.Status' \
    --output text)"
  if [[ "$SERVICE_STATUS" == "RUNNING" ]]; then
    break
  fi
  if [[ "$SERVICE_STATUS" == "CREATE_FAILED" ]]; then
    fail "App Runner service creation failed. Check the App Runner console logs for ${SERVICE_NAME}."
  fi
  sleep 15
done

[[ "$SERVICE_STATUS" == "RUNNING" ]] || fail "Timed out waiting for App Runner service to reach RUNNING state."

SERVICE_URL="$(aws apprunner describe-service \
  --service-arn "$SERVICE_ARN" \
  --query 'Service.ServiceUrl' \
  --output text)"

python3 - "$OUTPUT_FILE" <<PY
import json

data = {
    "region": "${AWS_REGION}",
    "account_id": "${ACCOUNT_ID}",
    "project_prefix": "${APP_PREFIX}",
    "service_name": "${SERVICE_NAME}",
    "service_arn": "${SERVICE_ARN}",
    "service_url": "${SERVICE_URL}",
    "connection_name": "${CONNECTION_NAME}",
    "connection_arn": "${CONNECTION_ARN}",
    "vpc_id": "${VPC_ID}",
    "public_subnet_ids": ["${PUBLIC_SUBNET1_ID}", "${PUBLIC_SUBNET2_ID}"],
    "private_subnet_ids": ["${PRIVATE_SUBNET1_ID}", "${PRIVATE_SUBNET2_ID}"],
    "db_instance_identifier": "${DB_IDENTIFIER}",
    "db_endpoint": "${DB_ENDPOINT}",
    "db_subnet_group": "${DB_SUBNET_GROUP_NAME}",
    "db_security_group_id": "${DB_SG_ID}",
    "apprunner_security_group_id": "${APP_SG_ID}",
    "vpc_connector_arn": "${VPC_CONNECTOR_ARN}",
    "secret_arn": "${SECRET_ARN}",
    "instance_role_arn": "${INSTANCE_ROLE_ARN}"
}

with open("${OUTPUT_FILE}", "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
PY

printf '\nProvisioning complete.\n'
printf 'App Runner URL: https://%s\n' "$SERVICE_URL"
printf 'Output file: %s\n' "$OUTPUT_FILE"
printf 'App Runner console: https://console.aws.amazon.com/apprunner/home?region=%s#/services\n' "$AWS_REGION"
printf 'RDS console: https://console.aws.amazon.com/rds/home?region=%s#database:id=%s;is-cluster=false\n' "$AWS_REGION" "$DB_IDENTIFIER"
printf 'Secrets Manager console: https://console.aws.amazon.com/secretsmanager/listsecrets?region=%s\n' "$AWS_REGION"
printf '\nImportant:\n'
printf '- Automatic deployments are enabled for branch %s.\n' "$GITHUB_BRANCH"
printf '- If you rotate DATABASE_URL in Secrets Manager later, trigger a new App Runner deployment.\n'
printf '- The PostgreSQL instance is publicly accessible for bootstrap. You can harden this later if desired.\n'
