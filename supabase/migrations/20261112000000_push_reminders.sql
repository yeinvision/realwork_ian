-- 일정 알림 웹 푸시: 알림 받을 기기 목록 + 이미 보낸 알림 기록
create table if not exists public.push_subs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz_offset int not null default 540,          -- 기기 시간대 (UTC 기준 분, 한국 = 540)
  ua text,
  created_at timestamptz not null default now(),
  last_ok timestamptz
);
alter table public.push_subs enable row level security;
drop policy if exists "push_subs own rows" on public.push_subs;
create policy "push_subs own rows" on public.push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 서버(service role)만 읽고 써요. 정책을 두지 않아 브라우저에서는 접근할 수 없어요.
create table if not exists public.push_sent (
  user_id uuid not null,
  fid text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, fid)
);
alter table public.push_sent enable row level security;

create extension if not exists pg_cron;
create extension if not exists pg_net;
-- 1분마다 push-reminders 함수를 부르는 cron 작업은 비밀값이 들어가므로 저장소 밖에서 등록해요 (README 참고).
