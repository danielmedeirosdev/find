# Payment dates and receipt identity

Adds `paid_on` without backfilling existing transactions. New ledger rows default to the São Paulo business date. `financial_receipts` is a security-invoker read model joining existing package/customer/pet/service and booking relations, with one row per ledger transaction. All cash metrics use `cash_date`; unknown legacy payment dates fall back to the recorded date and are labelled explicitly in the UI.

Dated RPCs reuse existing payment validation, owner checks, locks and request IDs. Date corrections update the original receipt without changing its amount. Every inserted date and subsequent correction is audited with actor, timestamp and reason in an owner-only history table. Existing legacy dates remain unknown until explicitly supplied by the owner.

Validation completed: build; 151 unit tests; lint (0 errors, 20 pre-existing warnings); database migration and disposable tenant regression suite inside BEGIN/ROLLBACK, including partial/full payments, delayed booking payments, duplicate request retries, date correction/audit, future dates, legacy rows and authenticated cross-tenant RLS checks.

Release pending: run `tests/ui/finance-mobile.cjs` against an isolated development server with VITE_SUPABASE_URL=https://stub.supabase.test and VITE_SUPABASE_ANON_KEY=stub on 127.0.0.1:4176. It must pass at 320/390/430/1440 widths. The current environment prevents Chromium from opening sockets; it did not run. No visual pass is claimed. No production migration has been applied and no production branch has been changed.

After visual validation: apply the migration, publish the frontend, check the Vercel deployment status and verify authenticated read-only receipt queries and unchanged original transaction IDs/amounts/created_at. Do not adjust any customer's historical payment dates during rollout.
