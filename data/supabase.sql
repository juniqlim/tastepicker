-- Supabase SQL Editor 에 붙여넣고 실행한다.
-- 내 평가만 여기에 둔다. 블로그 픽은 빌드할 때 HTML에 박히므로 저장하지 않는다.

create table if not exists rating (
  place_id   text not null,
  visited    date not null,
  level      int  not null check (level between 1 and 5),
  note       text not null default '',
  place_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (place_id, visited)
);

-- 한 가게를 여러 번 가면 방문 날짜로 구분한다. 갈 때마다 점수가 달라질 수 있다.

alter table rating enable row level security;

-- 누구나 읽는다. 공개해도 되는 내용이고 지도에 보여야 한다.
drop policy if exists "누구나 읽는다" on rating;
create policy "누구나 읽는다" on rating
  for select using (true);

-- 쓰기는 나만. 이메일이든 GitHub 계정이든 하나만 맞으면 된다.
-- 로그인 방식을 바꿔도 정책을 다시 고치지 않으려고 둘 다 본다.
drop policy if exists "나만 쓴다" on rating;
create policy "나만 쓴다" on rating
  for all
  using (
    auth.jwt() ->> 'email' = 'juniqlim@gmail.com'
    or auth.jwt() -> 'user_metadata' ->> 'user_name' = 'juniqlim'
  )
  with check (
    auth.jwt() ->> 'email' = 'juniqlim@gmail.com'
    or auth.jwt() -> 'user_metadata' ->> 'user_name' = 'juniqlim'
  );
