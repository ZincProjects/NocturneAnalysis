# Edge Functions

Deno, not Node. They are excluded from the app's `tsconfig.json` because they
resolve `jsr:` specifiers and `.ts` import paths that the Next.js TypeScript
configuration rightly rejects. Type-check them with Deno instead:

```bash
deno check supabase/functions/append-event/index.ts
```

`_shared/` is generated. Run `npm run edge:sync` after changing any module it
copies; `tests/edge-shared.test.ts` fails if the copy has drifted from its
source.

## Deploying

```bash
supabase functions deploy append-event
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform - do not add them to a `.env` file.
