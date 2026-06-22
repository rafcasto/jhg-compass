-- Quiz funnel: extra columns on the existing lead table.
-- jobhackers_leads already has: first_name, last_name, email, archetype, score,
-- tag, stage, source (written by lib/events.ts). The quiz adds the triage label,
-- the message-routing obstacle, and the raw answers for manual review.

alter table public.jobhackers_leads add column if not exists grade text null;
alter table public.jobhackers_leads add column if not exists obstacle text null;
alter table public.jobhackers_leads add column if not exists quiz_answers jsonb null;
