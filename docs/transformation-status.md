# Product transformation — validation checkpoint

Source base: fdd9f329d0e36cf23ed1f09c727e702d976d7d95.

Implemented: operational workspace shell, mobile navigation, focused daily overview, atomic booking create/edit, payment idempotency, saved quote and ledger totals, customer search and identity editing, pet search, retired guided setup.

Evidence at checkpoint: 86 unit tests pass; TypeScript/build pass; lint has 0 errors and 23 warnings. Transactional SQL fixture assertions pass and rollback. Authenticated API scenario passes customer/pet/catalogue/professional creation, multi-service booking/edit/start/finish, amount validation, payment retry, package consumption/edit, and persistence after relogin.

Supabase migration professional_workspace applied. No existing tenant rows altered or removed. An isolated QA tenant and fictional records were created.

Not approved for production: browser authentication test has not reached the dashboard; mobile viewport and full browser flows still pending. Do not treat this checkpoint as completion.

Run unit checks with npm test, npm run lint, npm run build. Browser checks: npx playwright test. Requires a QA account JSON in /tmp/onefind-qa-account.json or ONEFIND_QA_ACCOUNT, prepared only in an isolated tenant. Never commit credentials, sessions, screenshots containing user information, or auth storage.
