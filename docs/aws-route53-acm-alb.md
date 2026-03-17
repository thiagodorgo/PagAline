# Route 53, ACM, ALB, and HTTPS

This runbook moves Pagaline from direct EC2 access to:

- `app.<root-domain>` on Route 53
- public ACM certificate
- public Application Load Balancer
- HTTP to HTTPS redirect
- EC2 reachable only from the ALB security group

Official docs:

- ACM public certificates: <https://docs.aws.amazon.com/acm/latest/userguide/acm-public-certificates.html>
- ACM DNS validation: <https://docs.aws.amazon.com/acm/latest/userguide/domain-ownership-validation.html>
- ALB listeners and target groups: <https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html>
- Route 53 alias to ALB: <https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-elb-load-balancer.html>

## Assumptions

- Region: `us-east-1`
- EC2 instance already serves the app on port `80`
- App health endpoint: `/health`
- Target hostname: `app.pagaline.com`

## 1. Set variables

```bash
export AWS_REGION=us-east-1
export APP_NAME=pagaline
export ENV=prod
export ROOT_DOMAIN=pagaline.com
export APP_DOMAIN=app.${ROOT_DOMAIN}
export INSTANCE_ID=i-081d3641373eb3313
```

Resolve the current VPC, EC2 security group, and two public subnets from the instance:

```bash
export VPC_ID=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].VpcId' \
  --output text)

export EC2_SG_ID=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
  --output text)

export PUBLIC_SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=${VPC_ID}" "Name=map-public-ip-on-launch,Values=true" \
  --query 'Subnets[].SubnetId' \
  --output text)
```

Confirm:

```bash
echo "$VPC_ID"
echo "$EC2_SG_ID"
echo "$PUBLIC_SUBNETS"
```

## 2. Create or find the Route 53 hosted zone

If the hosted zone already exists in Route 53:

```bash
export HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "$ROOT_DOMAIN" \
  --query 'HostedZones[0].Id' \
  --output text | sed 's|/hostedzone/||')
```

If it does not exist, create it:

```bash
aws route53 create-hosted-zone \
  --name "$ROOT_DOMAIN" \
  --caller-reference "${ROOT_DOMAIN}-$(date +%s)"
```

Then set `HOSTED_ZONE_ID` from the output or rerun the lookup command above.

If the domain is registered outside Route 53, update its nameservers at the registrar before continuing with ACM validation.

## 3. Request the ACM certificate

```bash
export CERT_ARN=$(aws acm request-certificate \
  --domain-name "$APP_DOMAIN" \
  --validation-method DNS \
  --query 'CertificateArn' \
  --output text)

echo "$CERT_ARN"
```

Fetch the DNS validation record:

```bash
aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output json
```

If the hosted zone is in Route 53, create the validation record:

```bash
export ACM_RECORD_NAME=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' \
  --output text)

export ACM_RECORD_TYPE=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Type' \
  --output text)

export ACM_RECORD_VALUE=$(aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' \
  --output text)

cat > acm-validation.json <<JSON
{
  "Comment": "Validate ACM certificate for ${APP_DOMAIN}",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${ACM_RECORD_NAME}",
        "Type": "${ACM_RECORD_TYPE}",
        "TTL": 300,
        "ResourceRecords": [
          { "Value": "${ACM_RECORD_VALUE}" }
        ]
      }
    }
  ]
}
JSON

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file://acm-validation.json
```

Wait for issuance:

```bash
aws acm wait certificate-validated --certificate-arn "$CERT_ARN"
```

## 4. Create security group, target group, and ALB

Create the ALB security group:

```bash
export ALB_SG_ID=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-${ENV}-alb-sg" \
  --description "ALB ingress for ${APP_DOMAIN}" \
  --vpc-id "$VPC_ID" \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id "$ALB_SG_ID" \
  --ip-permissions '[
    {"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0","Description":"HTTP"}]},
    {"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0","Description":"HTTPS"}]}
  ]'
```

Create target group:

```bash
export TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
  --name "${APP_NAME}-${ENV}-tg" \
  --protocol HTTP \
  --port 80 \
  --vpc-id "$VPC_ID" \
  --target-type instance \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 15 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher HttpCode=200 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "$TARGET_GROUP_ARN"
```

Register the instance:

```bash
aws elbv2 register-targets \
  --target-group-arn "$TARGET_GROUP_ARN" \
  --targets Id="$INSTANCE_ID",Port=80
```

Create the ALB:

```bash
export ALB_ARN=$(aws elbv2 create-load-balancer \
  --name "${APP_NAME}-${ENV}-alb" \
  --type application \
  --scheme internet-facing \
  --security-groups "$ALB_SG_ID" \
  --subnets $PUBLIC_SUBNETS \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

export ALB_DNS_NAME=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

export ALB_ZONE_ID=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[0].CanonicalHostedZoneId' \
  --output text)
```

## 5. Create listeners

HTTP to HTTPS redirect:

```bash
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

HTTPS forward to target group:

```bash
aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn="$CERT_ARN" \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
  --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN"
```

## 6. Create the Route 53 alias record

```bash
cat > app-alias.json <<JSON
{
  "Comment": "Alias app domain to ALB",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${APP_DOMAIN}",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "${ALB_ZONE_ID}",
          "DNSName": "${ALB_DNS_NAME}",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
JSON

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file://app-alias.json
```

## 7. Restrict EC2 to accept traffic only from the ALB

Allow HTTP from the ALB security group:

```bash
aws ec2 authorize-security-group-ingress \
  --group-id "$EC2_SG_ID" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":80,\"ToPort\":80,\"UserIdGroupPairs\":[{\"GroupId\":\"${ALB_SG_ID}\",\"Description\":\"ALB to app\"}]}]"
```

Then remove old public HTTP access from the EC2 security group after you confirm the ALB is healthy:

```bash
aws ec2 describe-security-groups \
  --group-ids "$EC2_SG_ID" \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json
```

Look for a `0.0.0.0/0` rule on port `80` and revoke it:

```bash
aws ec2 revoke-security-group-ingress \
  --group-id "$EC2_SG_ID" \
  --ip-permissions '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]'
```

## 8. Validate

Check target health:

```bash
aws elbv2 describe-target-health \
  --target-group-arn "$TARGET_GROUP_ARN" \
  --output json
```

Check HTTPS:

```bash
curl -I "https://${APP_DOMAIN}"
curl -I "http://${APP_DOMAIN}"
```

Expected:

- `http://app.<root-domain>` returns `301`
- `https://app.<root-domain>` returns `200`

## Notes

- Keep the EC2 public IP for bootstrap only. After the ALB is healthy, treat the domain as the canonical entrypoint.
- Login should come after HTTPS so session cookies can be marked `Secure`.
- Re-enable the PWA only after auth is stable, to avoid caching authenticated HTML or private API responses by mistake.
