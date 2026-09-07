# cal.dudu-works.com 시작하기

예약 기간은 2026-09-09부터 2026-09-22까지입니다. 오전 09:00, 오후 13:00, 저녁 18:00, 총 42슬롯입니다.

## 1. ZIP을 풀고 VS Code에서 폴더 열기

ZIP을 풀어 package.json과 AGENTS.md가 있는 cal-dudu-starter 폴더를 엽니다. Node.js와 npm이 설치되어 있어야 합니다. Terminal 메뉴에서 New Terminal을 엽니다.

## 2. 같은 의존성 설치

Mac 터미널:

```sh
npm ci
npm test
npm run build
npm run dev
```

Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

각 명령이 종료된 뒤 다음 명령을 입력합니다. 마지막 명령은 서버를 계속 실행하므로 종료하지 않습니다. 브라우저에서 터미널의 Local 주소를 엽니다. 기본 주소는 http://localhost:5187 입니다. 가상 서비스 이름 cal.dudu-works.com은 실제 배포 주소가 아닙니다.

## 3. 공통 예약 시나리오

1. 고객 C01: 9/9 오전, 9/9 오후를 순서대로 신청합니다.
2. 고객 C02: 9/9 오전 하나를 신청합니다.
3. 어드민: C01의 9/9 오전을 확정합니다.
4. 고객 C02: 재선택 안내를 확인하고 9/10 오전을 신청합니다.
5. 어드민: C02의 9/10 오전을 확정합니다.
6. 어드민의 실행 기록에서 결과를 확인합니다.

희망 신청만으로 슬롯이 마감되지 않습니다. 확정된 슬롯에 다른 고객을 확정할 수 없습니다. 다른 희망이 하나라도 남아 있으면 접수 상태를 유지합니다.

## 4. Supabase SQL 설치

새 실습용 Supabase 프로젝트의 SQL Editor에서 New query를 엽니다. `sql/00_supabase.sql` 전체를 붙여 넣고 Run을 누릅니다. 테이블, 함수, 권한, 42슬롯이 함께 생성됩니다. 이전 버전의 SQL을 추가 실행하지 않습니다.

```sql
select count(*) as slots, min(date) as first_day, max(date) as last_day from public.slots;
```

예상 결과: 42, 2026-09-09, 2026-09-22.

RPC(앱에서 호출하는 DB 함수)는 submit_request, confirm_request, resubmit_request입니다. 고객은 Supabase Auth의 사용자 UUID로 식별합니다. 관리자 권한은 서버가 관리하는 app_metadata.role='admin'을 확인합니다. 고객이 수정할 수 있는 user_metadata에 관리자 권한을 넣지 않습니다.

현재 ZIP의 화면은 한 브라우저의 localStorage를 사용하는 공통 예약 실습 화면입니다. SQL 설치는 Supabase DB를 준비하는 단계입니다. 환경 변수 입력만으로 이 화면이 자동으로 Supabase에 연결되지는 않습니다. 로그인 화면과 DB 호출 연결은 아래 프롬프트로 이어갑니다.

## 5. Supabase 모드 설정 (선택사항)

### 5.1 로컬 모드 (기본)
환경 변수를 설정하지 않으면 로컬 모드로 실행됩니다.
- 브라우저 localStorage에 데이터 저장
- 역할 전환 가능 (테스트용)
- 진정한 인증 아님 (수업용 데모)

### 5.2 Supabase 모드 (선택적)
Supabase 프로젝트를 연결하려면:

1. **Supabase 프로젝트 생성**
   - https://supabase.com에서 신규 프로젝트 생성
   - SQL Editor에서 `sql/00_supabase.sql` 전체 실행

2. **.env.local 작성**
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   - 프로젝트 설정 > API에서 복사
   - service_role 키와 DB 비밀번호는 절대 입력하지 마세요
   - .env.local은 .gitignore에 등록됨 (Git에 올라가지 않음)

3. **테스트 사용자 생성**
   - Supabase 콘솔 > Authentication > Users > Add user
   - 고객 사용자 2명 생성
   - 어드민 사용자 1명 생성 후 Custom Claims 설정:
     ```json
     {"role": "admin"}
     ```

4. **앱 실행**
   - `npm run dev`
   - 앱이 자동으로 Supabase 모드 감지
   - Supabase 인증 로그인 필요 (현재 콘솔 로그인만 지원)

### 5.3 공통 시나리오 (로컬 / Supabase 동일)
1. 고객 C01: 9/9 오전, 9/9 오후를 순서대로 신청합니다
2. 고객 C02: 9/9 오전 하나를 신청합니다
3. 어드민: C01의 9/9 오전을 확정합니다
4. 고객 C02: 재선택 안내를 확인하고 9/10 오전을 신청합니다
5. 어드민: C02의 9/10 오전을 확정합니다
6. 어드민의 실행 기록에서 결과를 확인합니다

**예상 결과:**
- C01: 9/9 오전 확정
- C02: 9/10 오전 확정
- 로그에 submit/confirm/reselect 기록 5건

## 6. 구현 완료 체크리스트

- [x] 로컬 모드: localStorage 기반, 역할 전환 가능
- [x] Supabase 모드: Auth + RPC 호출 통합
- [x] 에러 표시: 인증/조회/저장 오류 화면 표시
- [x] 공통 시나리오: 2명 고객, 1명 어드민으로 완전 테스트
- [ ] 실제 Supabase 환경에서 테스트 (환경 준비 후 실행)

## 7. 테스트 결과 기록

Supabase 모드 테스트를 완료하면 아래 결과를 기록하세요:

**테스트 환경:**
- Supabase 프로젝트: [프로젝트명]
- 테스트 날짜: YYYY-MM-DD
- 테스트 사용자: C01 (customer@example.com), C02 (customer2@example.com), ADMIN (admin@example.com)

**테스트 시나리오 결과:**
1. C01 신청: 9/9 오전, 9/9 오후 → ✓/✗ (성공/실패)
2. C02 신청: 9/9 오전 → ✓/✗
3. 어드민 확정: C01 9/9 오전 → ✓/✗
4. C02 재선택 안내 표시 → ✓/✗
5. C02 신청: 9/10 오전 → ✓/✗
6. 어드민 확정: C02 9/10 오전 → ✓/✗
7. 실행 기록 5건 확인 → ✓/✗

**오류 발생 시 기록:**
- 오류 메시지: [구체적 내용]
- 발생 시점: [어느 단계]
- 해결 방법: [취한 조치]

## 8. 본인 기능 얹기

공통 시나리오가 통과하면 Git에 기본 버전을 저장합니다. 고객 카드에서 한 장면을 선택하여 Journey, Service Blueprint, 기능 선택 이유를 적습니다. UI의 희망 선택 상한 3과 1처럼 설정 하나만 바꾸고 동일 입력의 결과를 비교합니다. 42슬롯과 슬롯당 확정 한 명이라는 DB 규칙은 유지합니다.
