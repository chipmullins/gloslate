# Infrastructure

`aws/tabitat.yml` is a CloudFormation template for the whole AWS setup (us-east-1): the VPC, the EC2 server that runs staging and production, S3 buckets, SES, SNS, Route 53 and alarms. The AWS names still say `tabitat` from before the rename.

How to deploy and run it is in [`../docs/deploy.md`](../docs/deploy.md).
