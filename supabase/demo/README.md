# Demo Data Layers

Demo layers in this directory are not migrations. They are optional product-demo data packs that can be applied and removed independently.

## World Campus WhatsApp

Apply the mock WhatsApp layer:

```sh
psql "$DATABASE_URL" -f supabase/demo/world-campus-whatsapp-seed.sql
```

Remove it after the demo:

```sh
psql "$DATABASE_URL" -f supabase/demo/world-campus-whatsapp-cleanup.sql
```

The layer is scoped with deterministic `90000000-...` UUIDs, `demo_world_campus_whatsapp` tags, and `demo-world-campus-whatsapp:` provider message IDs.
