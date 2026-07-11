-- ──────────────────────────────────────────────────────────────────────────────
-- Forensic Engine – Supabase Schema
-- Run this once in Supabase SQL Editor (or via supabase db push).
-- ──────────────────────────────────────────────────────────────────────────────

-- Storage bucket (also create this in Supabase Dashboard → Storage)
-- insert into storage.buckets (id, name, public) values ('forensic-files', 'forensic-files', false);

-- ─── Reports table ────────────────────────────────────────────────────────────
create table if not exists public.forensic_reports (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              text        not null,               -- auth.users.id or external ID
  file_name            text,                               -- original filename
  file_path            text,                               -- path in Supabase Storage
  file_type            text,                               -- "image" | "pdf" | "unknown"
  file_size            bigint,                             -- bytes
  mode                 text        default 'full',         -- "light" | "full"

  -- Lifecycle
  status               text        not null default 'pending'
                                   check (status in ('pending','processing','complete','failed')),
  error_message        text,                               -- populated on failure

  -- Risk summary (promoted for fast queries / list views)
  risk_score           smallint    check (risk_score between 0 and 100),
  risk_level           text        check (risk_level in ('none','low','medium','high')),
  explanation_summary  text,                               -- single-line UI card string
  flags                jsonb       default '[]'::jsonb,    -- array of flag strings

  -- Full engine output (large — separate column so selects can exclude it)
  full_report          jsonb,

  -- Timestamps
  created_at           timestamptz not null default now(),
  completed_at         timestamptz
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists forensic_reports_user_id_idx    on public.forensic_reports (user_id);
create index if not exists forensic_reports_status_idx     on public.forensic_reports (status);
create index if not exists forensic_reports_risk_level_idx on public.forensic_reports (risk_level);
create index if not exists forensic_reports_created_at_idx on public.forensic_reports (created_at desc);

-- GIN index for querying flags array contents
create index if not exists forensic_reports_flags_gin on public.forensic_reports using gin (flags);

-- ─── Row-level security ───────────────────────────────────────────────────────
alter table public.forensic_reports enable row level security;

-- Users can read only their own reports
create policy "Users read own reports"
  on public.forensic_reports for select
  using (user_id = auth.uid()::text);

-- Users can insert reports for themselves (the edge function uses service role
-- and bypasses RLS, so this policy is for direct client inserts if needed)
create policy "Users insert own reports"
  on public.forensic_reports for insert
  with check (user_id = auth.uid()::text);

-- Only service role (edge functions) can update reports
-- (regular users should not be able to flip their own risk_score)
-- This is enforced by NOT creating an UPDATE policy for authenticated role.

-- ─── View: lightweight list (excludes full_report blob) ──────────────────────
create or replace view public.forensic_report_summaries as
  select
    id,
    user_id,
    file_name,
    file_type,
    file_size,
    mode,
    status,
    error_message,
    risk_score,
    risk_level,
    explanation_summary,
    flags,
    created_at,
    completed_at,
    -- computed convenience fields
    extract(epoch from (completed_at - created_at))::int as duration_seconds
  from public.forensic_reports;

-- ─── Useful query examples ────────────────────────────────────────────────────
-- All high-risk reports for a user:
--   select * from forensic_report_summaries
--   where user_id = '<uid>' and risk_level = 'high'
--   order by created_at desc;

-- Reports with a specific flag:
--   select id, explanation_summary
--   from forensic_reports
--   where flags @> '["A ZIP file signature was found embedded in the image bytes."]';

-- Completion time distribution:
--   select risk_level, avg(duration_seconds), count(*)
--   from forensic_report_summaries
--   where status = 'complete'
--   group by risk_level;
