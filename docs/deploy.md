# Deploying Gloslate to AWS

How it works: one small EC2 server of Gloslate's own (`t3.micro`, upgradeable) runs staging and
production side by side with Docker Compose. Each has its own Postgres on a separate encrypted data
disk, with nightly backups to S3 (kept 35 days). Caddy serves HTTPS with automatic certificates.
Receipts and PDFs go to private S3 buckets, email goes through SES, and texts through SNS. Expect
about $10–15/month after free credits.

Nothing outside AWS has AWS access. GitHub only builds the app image and stores it in GitHub's
package registry (`ghcr.io/chipmullins/tabitat-api`). The server checks that registry every 2
minutes and updates itself (`tabitat-update`, a systemd timer). I set it up this way because the AWS
account blocks GitHub sign-in (OIDC) connections, so GitHub never gets AWS access at all.

## It can't touch Glofly

- Gloslate has its own VPC, server, security group, buckets, IAM role and DNS zone, all named
  `tabitat-*` and tagged `Project=tabitat`. Glofly's servers can't reach Gloslate's, and the
  reverse is also true.
- The server's role can only use Gloslate's buckets, send email from the Gloslate domain, and send
  texts.
- There's no SSH. For emergencies, use EC2 → the `tabitat` instance → Connect → Session
  Manager.
- Shared account-wide: SES sending reputation, the SMS monthly spending cap, service quotas, and
  the bill (Gloslate is tagged and has its own budget alert).

## One-time setup

1. GitHub token for the server. On github.com, open Settings → Developer settings → Personal
   access tokens → Tokens (classic) → Generate new token (classic):
   - Note: `Tabitat server`
   - Expiration: No expiration, or a year with a reminder to renew
   - Tick only read:packages, then generate and copy the token.
2. AWS: sign in to the Glofly account in region us-east-1 (N. Virginia).
   - Go to CloudFormation → Create stack → With new resources → Upload a template file and
     upload `infra/aws/tabitat.yml`.
   - Stack name: `tabitat`.
   - Fill in AlertEmail and GitHubPackagesToken (the token from step 1). Leave everything
     else as is.
   - Click Next, then Next again, tick the IAM acknowledgment, and click Submit. It takes about
     5 minutes.
3. Outputs tab: copy the four NameServers into GoDaddy under tabitat.app → DNS →
   Nameservers → Change → "I'll use my own nameservers".
4. Confirm the "AWS Notification – Subscription Confirmation" email.

staging.tabitat.app comes up as soon as DNS switches (usually under an hour). The first image is
already in GitHub's registry from the last push.

## Day to day

- Every push to `main` that touches `api/` builds a new `:staging` image. staging.tabitat.app
  updates within about 2 minutes.
- To go live: GitHub → Actions → Release → Run workflow → "promote staging to production".
  This copies the tested staging image to `:production`, and tabitat.app updates within about 2
  minutes.
- Settings that aren't secret live in `api/deploy/staging.env` and `api/deploy/production.env`
  and ship with the image (store URLs, Apple Team ID, LEGAL_DRAFT…). Secrets
  (`SECRET_KEY_BASE`, database passwords) are generated on the server's first boot in
  `/data/env/*.secrets.env` and never leave it.
- `api/deploy/compose.yml` and `api/deploy/Caddyfile` describe the server. They also ship with the
  image, and the server takes them from the production image once one exists.

## Finding Gloslate in AWS

- Resource Groups & Tag Editor → Saved resource groups → Tabitat lists every Gloslate resource (the AWS names still say Tabitat).
- CloudWatch → Dashboards → Tabitat shows CPU, health, network and disk.
- Billing → Cost Explorer, filtered by tag `Project = tabitat`, shows Gloslate's costs (after
  activating the `Project` cost allocation tag once).

## After launch

- Email: once DNS switches, SES verifies the domain by itself. Then request SES production
  access in the SES console.
- Texts: in the SNS console, register a toll-free number, raise the monthly SMS spend limit
  (default $1), and leave the sandbox.

## Operations (through Session Manager)

- Logs: `docker logs -f tabitat-production-web` (or `-staging-`).
- Force an update now: `sudo systemctl start tabitat-update`.
- Rails console: `docker exec -it tabitat-production-web bin/rails console`.
- Replace the GitHub token: edit the second line of `/data/env/ghcr`.
- Restore a backup: `gunzip -c file.sql.gz | docker exec -i tabitat-<env>-db psql -U tabitat`
  (backups are in `s3://tabitat-backups-<account>/tabitat-<env>-db/`).
- Bigger server: update the stack with InstanceType `t3.small` (a few minutes of downtime).
  Data and secrets live on the separate disk and survive this.
