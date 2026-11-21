# Gloslate API

The Rails 8 side of Gloslate. It serves:

- the JSON API the app uses (`/v1`)
- the staff API (`/admin/v1`) and Gloslate Control (`/control`)
- the public pages: the landing site, request pages (`/r/:token`), invites, privacy and terms

## Setup

You'll need Ruby 3.3.6, PostgreSQL 16 and libvips (`brew install vips`).

```bash
bundle install        # gems come from vendor/cache
bin/rails db:prepare
bin/rails s           # http://localhost:3000, sign-in codes show up in log/development.log
bin/rails test
```

Make yourself a staff account for Control:

```bash
bin/rails staff:create EMAIL=you@example.com NAME="Your Name"
```

## Where things are

- `app/services/`: the real logic (splits, netting, payments, statements, requests, recaps). Controllers stay thin.
- `app/controllers/v1/`: the app API
- `app/controllers/admin/` and `control/`: staff API and console
- `db/structure.sql`: the schema, including the triggers that keep the ledger append-only
- `deploy/`: Compose file, Caddyfile and non-secret env for staging and production

More in [`../docs`](../docs).
