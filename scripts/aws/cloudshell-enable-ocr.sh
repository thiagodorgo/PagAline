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
export AWS_PAGER=""

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
DEFAULT_PREFIX="pagaline-prod"
APP_PREFIX_RAW="$(prompt_default 'Project prefix / App Runner service name' "${APP_PREFIX:-$DEFAULT_PREFIX}")"
APP_PREFIX="$(printf '%s' "$APP_PREFIX_RAW" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//; s/--+/-/g')"

SERVICE_ARN="$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='${APP_PREFIX}'].ServiceArn | [0]" \
  --output text \
  --no-cli-pager)"

resource_exists "$SERVICE_ARN" || fail "Could not find an App Runner service named ${APP_PREFIX}."

SERVICE_JSON="$(aws apprunner describe-service --service-arn "$SERVICE_ARN" --output json --no-cli-pager)"
SERVICE_URL="$(python3 - <<'PY' "$SERVICE_JSON"
import json
import sys
print(json.loads(sys.argv[1])["Service"]["ServiceUrl"])
PY
)"

INSTANCE_ROLE_ARN="$(python3 - <<'PY' "$SERVICE_JSON"
import json
import sys
print(json.loads(sys.argv[1])["Service"]["InstanceConfiguration"]["InstanceRoleArn"])
PY
)"
resource_exists "$INSTANCE_ROLE_ARN" || fail "App Runner instance role not found on the service."

INSTANCE_ROLE_NAME="${INSTANCE_ROLE_ARN##*/}"
OCR_BUCKET_NAME_DEFAULT="${APP_PREFIX}-${ACCOUNT_ID}-${AWS_REGION}-ocr"
OCR_BUCKET_NAME="$(prompt_default 'OCR bucket name' "${OCR_BUCKET_NAME:-$OCR_BUCKET_NAME_DEFAULT}")"
OCR_POLICY_NAME="${APP_PREFIX}-apprunner-ocr-access"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log "Creating or reusing private S3 bucket"
if aws s3api head-bucket --bucket "$OCR_BUCKET_NAME" >/dev/null 2>&1; then
  log "Bucket already exists: ${OCR_BUCKET_NAME}"
else
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$OCR_BUCKET_NAME" --no-cli-pager >/dev/null
  else
    aws s3api create-bucket \
      --bucket "$OCR_BUCKET_NAME" \
      --region "$AWS_REGION" \
      --create-bucket-configuration "LocationConstraint=${AWS_REGION}" \
      --no-cli-pager >/dev/null
  fi
fi

aws s3api put-public-access-block \
  --bucket "$OCR_BUCKET_NAME" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
  --no-cli-pager >/dev/null

aws s3api put-bucket-encryption \
  --bucket "$OCR_BUCKET_NAME" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
  --no-cli-pager >/dev/null

BUCKET_CORS_FILE="$TMP_DIR/cors.json"
cat >"$BUCKET_CORS_FILE" <<JSON
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedOrigins": [
        "https://${SERVICE_URL}",
        "http://localhost:5000",
        "http://localhost:5173"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
JSON

aws s3api put-bucket-cors \
  --bucket "$OCR_BUCKET_NAME" \
  --cors-configuration "file://${BUCKET_CORS_FILE}" \
  --no-cli-pager >/dev/null

log "Attaching S3 and Textract permissions to ${INSTANCE_ROLE_NAME}"
ROLE_POLICY_FILE="$TMP_DIR/ocr-policy.json"
cat >"$ROLE_POLICY_FILE" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListOcrBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::${OCR_BUCKET_NAME}"
    },
    {
      "Sid": "ReadWriteOcrObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::${OCR_BUCKET_NAME}/*"
    },
    {
      "Sid": "UseTextractExpenseAnalysis",
      "Effect": "Allow",
      "Action": [
        "textract:AnalyzeExpense"
      ],
      "Resource": "*"
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name "$INSTANCE_ROLE_NAME" \
  --policy-name "$OCR_POLICY_NAME" \
  --policy-document "file://${ROLE_POLICY_FILE}" \
  --no-cli-pager >/dev/null

sleep 10

log "Preparing App Runner service update payload"
UPDATE_FILE="$TMP_DIR/update-service.json"
python3 - "$SERVICE_JSON" "$SERVICE_ARN" "$AWS_REGION" "$OCR_BUCKET_NAME" "$UPDATE_FILE" <<'PY'
import json
import sys

service_doc = json.loads(sys.argv[1])["Service"]
service_arn = sys.argv[2]
region = sys.argv[3]
bucket_name = sys.argv[4]
output_file = sys.argv[5]

cpu_map = {
    "256": "0.25 vCPU",
    "512": "0.5 vCPU",
    "1024": "1 vCPU",
    "2048": "2 vCPU",
    "4096": "4 vCPU",
}
memory_map = {
    "512": "0.5 GB",
    "1024": "1 GB",
    "2048": "2 GB",
    "3072": "3 GB",
    "4096": "4 GB",
    "6144": "6 GB",
    "8192": "8 GB",
    "10240": "10 GB",
    "12288": "12 GB",
}

code_repo = service_doc["SourceConfiguration"]["CodeRepository"]
code_values = code_repo["CodeConfiguration"]["CodeConfigurationValues"]
runtime_env = dict(code_values.get("RuntimeEnvironmentVariables", {}))
runtime_env["NODE_ENV"] = runtime_env.get("NODE_ENV", "production")
runtime_env["AWS_REGION"] = region
runtime_env["AWS_DEFAULT_REGION"] = region
runtime_env["OCR_BUCKET_NAME"] = bucket_name
code_values["RuntimeEnvironmentVariables"] = runtime_env

payload = {
    "ServiceArn": service_arn,
    "SourceConfiguration": {
        "AuthenticationConfiguration": service_doc["SourceConfiguration"]["AuthenticationConfiguration"],
        "AutoDeploymentsEnabled": service_doc["SourceConfiguration"]["AutoDeploymentsEnabled"],
        "CodeRepository": {
            "RepositoryUrl": code_repo["RepositoryUrl"],
            "SourceCodeVersion": code_repo["SourceCodeVersion"],
            "CodeConfiguration": {
                "ConfigurationSource": code_repo["CodeConfiguration"]["ConfigurationSource"],
                "CodeConfigurationValues": code_values,
            },
        },
    },
    "InstanceConfiguration": {
        "Cpu": cpu_map.get(service_doc["InstanceConfiguration"]["Cpu"], service_doc["InstanceConfiguration"]["Cpu"]),
        "Memory": memory_map.get(service_doc["InstanceConfiguration"]["Memory"], service_doc["InstanceConfiguration"]["Memory"]),
        "InstanceRoleArn": service_doc["InstanceConfiguration"]["InstanceRoleArn"],
    },
    "HealthCheckConfiguration": service_doc["HealthCheckConfiguration"],
    "NetworkConfiguration": service_doc["NetworkConfiguration"],
    "AutoScalingConfigurationArn": service_doc["AutoScalingConfigurationSummary"]["AutoScalingConfigurationArn"],
}

source_directory = code_repo.get("SourceDirectory")
if source_directory:
    payload["SourceConfiguration"]["CodeRepository"]["SourceDirectory"] = source_directory

with open(output_file, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
PY

log "Updating App Runner service"
aws apprunner update-service \
  --cli-input-json "file://${UPDATE_FILE}" \
  --no-cli-pager >/dev/null

printf '\nOCR enablement started.\n'
printf 'Bucket: %s\n' "$OCR_BUCKET_NAME"
printf 'Service: %s\n' "$APP_PREFIX"
printf 'Monitor with:\n'
printf "aws apprunner describe-service --service-arn '%s' --query 'Service.Status' --output text --no-cli-pager\n" "$SERVICE_ARN"
