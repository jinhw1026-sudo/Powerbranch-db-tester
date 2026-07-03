-- Supabase SQL Editor에서 이 내용을 그대로 붙여넣고 Run 하세요.

create table if not exists entries (
  id text primary key,
  owner text,
  purchase_month text,
  purchase_date text,
  customer_name text,
  call1 text,
  call2 text,
  call3 text,
  call4 text,
  call5 text,
  call6 text,
  intent text,
  seatplan text,
  consult text,
  closing text,
  premium numeric default 0,
  note text,
  created_at timestamptz default now()
);

-- 로그인 없이 누구나 읽고 쓸 수 있게 허용 (팀 내부용, 링크를 아는 사람만 접근한다는 전제)
alter table entries enable row level security;

create policy "public read" on entries
  for select using (true);

create policy "public insert" on entries
  for insert with check (true);

create policy "public update" on entries
  for update using (true);

create policy "public delete" on entries
  for delete using (true);

-- 실시간 동기화(입력하면 다른 사람 화면에도 바로 반영) 활성화
alter publication supabase_realtime add table entries;
