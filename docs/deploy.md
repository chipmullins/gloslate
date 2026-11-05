# Deploying Tabitat to AWS

Lean setup: **one small EC2 server of Tabitat's own** (`t3.micro`, upgradeable) running the
staging and production sites with Kamal, each with its own Postgres on a separate data disk.
Nightly database backups go to S3 (kept 35 days). Files (receipts, PDFs) go to private S3
buckets. Email goes through SES and texts through SNS. Expect about $10–15/month after
free credits.

## It can't touch Glofly

- Tabitat has its **own VPC, server, security group, buckets and IAM roles**, all named
  `tabitat-*` and tagged `Project=tabitat`. Glofly's servers can't reach Tabitat's, and
  Tabitat's can't reach Glofly's.
- GitHub uses the role `tabitat-github-deploy`. That role can only:
  - run CloudFormation stacks named `tabitat-*` (through `tabitat-cfn-exec`),
  - read and write `/tabitat/*` parameters,
  - open SSH on the Tabitat-tagged security group during a deploy.
- `tabitat-cfn-exec` is denied from stopping, deleting or changing any EC2 network or server
  resource not tagged `Project=tabitat`. Its S3 and IAM rights are limited to `tabitat-*` names.
- Things AWS shares account-wide, which a second account would separate:
  - SES sending reputation
  - the SMS monthly spending cap
  - service quotas (5 VPCs and 5 Elastic IPs per region by default)
  - the bill (Tabitat is tagged, and gets its own budget alert)

Your own console sign-in is unchanged and can see and manage everything.

## One-time setup (Chip)

1. Sign in to AWS and set the region to **us-east-1 (N. Virginia)**.
2. CloudFormation → **Create stack** → *With new resources* → **Upload a template file**:
   `infra/aws/bootstrap.yml`. Name the stack `tabitat-bootstrap`.
   - If the account already has a GitHub "OIDC provider" (for example from Glofly), set
     **CreateGitHubOidcProvider = false**. If you're not sure, leave it `true`. If the stack
     then fails with "already exists", delete the failed stack and try again with `false`.
   - Tick "I acknowledge that AWS CloudFormation might create IAM resources with custom names".
3. When it says CREATE_COMPLETE, open **Outputs** and copy **DeployRoleArn**.
4. In GitHub, go to repo **Settings → Secrets and variables → Actions → Variables** and add:
   - `AWS_ROLE_ARN`: the value from step 3
   - `ALERT_EMAIL`: where "server down" and budget alerts go
   - `TABITAT_DOMAIN`: e.g. `tabitat.app`. Leave it unset until you own the domain; the server
     still gets built, the app just isn't deployed yet.
5. Actions → **Deploy** → **Run workflow** (staging). The first run takes about 10 minutes.

## After the first run

- **Domain:** add A records for `@`, `api`, `admin-api` and `staging` pointing to the
  **Server IP** shown in the run summary. HTTPS certificates are issued automatically on
  the first visit.
- **Email:** add the three DKIM CNAME records listed in the run summary. Then, in the SES
  console, choose **Request production access** (until AWS approves it, SES only sends to
  verified addresses).
- **Texts:** in the SNS console, **Text messaging (SMS)**:
  1. Register a toll-free number.
  2. Raise the monthly spend limit (default $1).
  3. Leave sandbox.
- **Budget:** in Billing → **Cost allocation tags**, activate `Project` so the Tabitat budget
  counts only Tabitat.

## Day to day

- Every push to `main` that touches `api/` or `infra/` updates the stack and deploys **staging**.
- **Production:** Actions → Deploy → Run workflow → `production`.
- Secrets are created once in SSM Parameter Store under `/tabitat/` and never committed or
  overwritten:
  - `SECRET_KEY_BASE` and `DATABASE_PASSWORD` for each environment
  - the deploy SSH key
- Backups are in `s3://tabitat-backups-<account>/tabitat-<env>-db/`. To restore:
  `gunzip -c file.sql.gz | docker exec -i tabitat-<env>-db psql -U tabitat`.
- **Upgrading later:**
  - set repo variable `INSTANCE_TYPE` to `t3.small` (a few minutes of downtime);
  - for real traffic, move Postgres to RDS and point `DB_HOST` at it.
