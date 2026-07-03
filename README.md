# 파워지점 DB 테스터 - 배포 가이드

아이디/비밀번호 없이 링크만 열면 바로 쓸 수 있는 팀 공용 웹사이트를 만드는 절차입니다.
전부 무료 서비스만 사용하고, 코딩 지식 없이 클릭만으로 진행할 수 있어요. 총 15~20분 정도 걸립니다.

전체 흐름: **① Supabase(데이터 저장소) 만들기 → ② GitHub에 코드 올리기 → ③ Vercel로 배포 → ④ 팀원에게 링크 공유**

---

## ① Supabase 프로젝트 만들기 (데이터가 저장될 곳)

1. https://supabase.com 접속 → **Start your project** → GitHub 계정으로 가입/로그인
2. **New project** 클릭
   - Name: `powerbranch` (아무 이름이나 가능)
   - Database Password: 아무 비밀번호나 설정 후 꼭 메모해두기
   - Region: `Northeast Asia (Seoul)` 선택
   - **Create new project** 클릭 (1~2분 정도 준비 시간이 걸려요)
3. 왼쪽 메뉴에서 **SQL Editor** 클릭 → **New query**
4. 이 프로젝트 폴더 안에 있는 `supabase.sql` 파일을 열어서 내용을 전부 복사 → SQL Editor에 붙여넣기 → 오른쪽 아래 **Run** 클릭
   - "Success. No rows returned" 메시지가 뜨면 정상입니다.
5. 왼쪽 메뉴 **Project Settings(톱니바퀴)** → **API** 클릭
   - **Project URL** 값을 복사해둡니다 (예: `https://abcdefgh.supabase.co`)
   - **anon public** 키 값을 복사해둡니다 (긴 문자열)
   - 이 두 개가 나중에 필요합니다.

## ② GitHub에 코드 올리기

1. https://github.com 접속 → 계정이 없다면 가입
2. 오른쪽 위 **+** → **New repository** 클릭
   - Repository name: `powerbranch-db-tester`
   - **Public** 선택 (또는 Private도 무방)
   - **Create repository** 클릭
3. 생성된 빈 저장소 화면에서 **uploading an existing file** 링크 클릭
4. 이 프로젝트 폴더 안의 파일/폴더를 전부(★ `node_modules`, `dist`, `.env` 제외) 끌어다 놓기
   - `src` 폴더, `package.json`, `vite.config.js`, `index.html`, `supabase.sql`, `.gitignore`, `.env.example` 등
5. 아래 **Commit changes** 클릭

## ③ Vercel로 배포하기

1. https://vercel.com 접속 → **Sign Up** → GitHub 계정으로 가입/로그인
2. **Add New...** → **Project** 클릭
3. 방금 올린 `powerbranch-db-tester` 저장소를 찾아서 **Import** 클릭
4. **Environment Variables** 항목을 펼치고 아래 2개를 추가합니다.
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | ①에서 복사해둔 Project URL |
   | `VITE_SUPABASE_ANON_KEY` | ①에서 복사해둔 anon public 키 |
5. **Deploy** 클릭 → 1~2분 기다리면 완료
6. 완료 화면에 나오는 `https://powerbranch-db-tester-xxxx.vercel.app` 같은 주소가 **팀 공용 링크**입니다.

## ④ 팀원에게 공유

이 링크를 4명에게 보내주세요. 각자 휴대폰/PC 어디서 열어도:
- 이름 선택 → 바로 입력 시작 (아이디/비밀번호 없음)
- 누가 입력하든 실시간으로 서로 화면에 반영됨
- 대시보드에서 언제든 엑셀 다운로드 가능

---

## 나중에 수정하고 싶을 때

- 코드를 다시 수정해서 GitHub 저장소에 올리면(같은 방식으로 파일 업로드) Vercel이 자동으로 재배포합니다.
- Supabase 대시보드 → **Table Editor** → `entries` 테이블에서 데이터를 직접 확인/수정/삭제할 수도 있습니다.

## 문제가 생기면

- 사이트가 열리는데 "Supabase 연결이 안 되어 있어요" 문구만 보인다면 → Vercel 프로젝트의 **Settings → Environment Variables**에 값이 제대로 들어갔는지 확인 후 **Deployments**에서 재배포(Redeploy)하세요.
- 입력해도 실시간 반영이 안 된다면 → Supabase **Database → Replication**에서 `entries` 테이블의 Realtime이 켜져 있는지 확인하세요 (위 SQL의 마지막 줄이 이걸 자동으로 켭니다).
