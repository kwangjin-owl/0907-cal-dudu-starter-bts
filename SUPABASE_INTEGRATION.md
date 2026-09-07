# Supabase 모드 통합 가이드

## 개요

cal.dudu-works.com은 **로컬 모드**와 **Supabase 모드** 두 가지 운영 모드를 지원합니다.

- **로컬 모드** (기본): 브라우저 localStorage 사용, 수업/테스트용
- **Supabase 모드** (선택): 실제 데이터베이스 + 인증 사용

## 구현 내용

### 1. Supabase 클라이언트 (`src/utils/supabase.ts`)

**기능:**
- `initSupabase()`: 환경 변수에서 Supabase 클라이언트 초기화
- `getCurrentUser()`: 현재 로그인 사용자 조회
- `getAdminStatus()`: 사용자가 어드민인지 확인 (app_metadata.role 검사)
- 인증 함수: `signUp()`, `signIn()`, `signOut()`

**RPC 래퍼:**
- `submitRequest()` → `public.submit_request` RPC 호출
- `confirmRequest()` → `public.confirm_request` RPC 호출
- `resubmitRequest()` → `public.resubmit_request` RPC 호출

**조회 함수:**
- `getSlots()`: 모든 슬롯 조회
- `getMyRequests()`: 현재 사용자의 신청 + 후보 조회
- `getAllRequests()`: 모든 신청 조회 (어드민용)
- `getLogs()`: 운영 기록 조회

### 2. App.tsx 모드 감지

**로직:**
```typescript
if (isSupabaseConfigured()) {
  // VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 있으면 Supabase 모드
  setMode('supabase');
  // 현재 세션 조회 → 사용자 UUID 저장
  // admin 권한 확인 → 역할 결정 (로컬 모드와 달리 전환 불가)
} else {
  // 환경 변수 없으면 로컬 모드
  setMode('local');
}
```

**차이점:**
| 기능 | 로컬 모드 | Supabase 모드 |
|-----|---------|-------------|
| 역할 전환 | 가능 (테스트용) | 불가 (실제 권한) |
| 데이터 저장소 | localStorage | PostgreSQL |
| 인증 | 없음 (demo 용 고객코드) | Supabase Auth (UUID) |
| 권한 | 로컬 변수 | app_metadata.role |

### 3. CustomerPage 통합

**처리:**
```typescript
if (mode === 'supabase' && userId) {
  // Supabase RPC 호출
  await supabaseApi.submitRequest(userId, selectedSlots, operationId);
  // 데이터 조회
  const { requests, candidates } = await supabaseApi.getMyRequests(userId);
} else {
  // 로컬 로직 유지
  await om.submitRequest(customerId, selectedSlots, operationId);
}
```

**고객ID 결정:**
- 로컬: 입력값 (C01, C02, ...)
- Supabase: userId (Supabase UUID) → 변경 불가

### 4. AdminPage 통합

**처리:**
- Supabase 모드: `getAllRequests()` → 전체 요청 조회 + confirm RPC 호출
- 로컬 모드: `OperationManager.getAdminRequests()` 유지
- 로그: Supabase 테이블 `operation_logs` 조회

### 5. 에러 처리

**원칙:**
- Auth 오류 (로그인 실패) → 화면에 "로그인 필요" 표시
- DB 조회 오류 → "데이터 조회 실패: [에러]" 표시
- DB 저장 오류 → "저장 오류: [에러]" 표시
- 절대로 오류를 숨기거나 로컬 모드로 자동 폴백하지 않음

**예시:**
```typescript
try {
  const result = await supabaseApi.submitRequest(...);
  if (!result.success) {
    setError(`신청 오류: ${result.error}`);
  }
} catch (error) {
  setError(`신청 오류: ${String(error)}`);  // 네트워크/권한 오류
}
```

## 환경 변수 설정

### .env.local (개발용)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5...
```

### 보안 규칙
- ❌ service_role 키 입력하지 마세요 (브라우저에 노출)
- ❌ DB 비밀번호 입력하지 마세요
- ✓ .env.local은 .gitignore에 등록됨
- ✓ 브라우저에는 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY만 전달

## SQL 설정 (한 번만 실행)

Supabase SQL Editor에서:
```sql
-- sql/00_supabase.sql 전체 복사 + Run
```

결과 확인:
```sql
SELECT COUNT(*) AS slots, MIN(date) AS first_day, MAX(date) AS last_day FROM public.slots;
-- 예상: 42 | 2026-09-09 | 2026-09-22
```

## 테스트 시나리오

### 전제 조건
1. Supabase 프로젝트 생성 ✓
2. SQL 설치 ✓
3. 테스트 사용자 3명 생성 (고객 2명, 어드민 1명) ✓
4. .env.local 작성 ✓
5. `npm run dev` 실행 ✓

### 공통 시나리오

| 단계 | 사용자 | 작업 | 예상 결과 | 실제 결과 |
|-----|------|------|---------|---------|
| 1 | C01 | 9/9 am, 9/9 pm 신청 | received | ✓/✗ |
| 2 | C02 | 9/9 am 신청 | received | ✓/✗ |
| 3 | ADMIN | C01 9/9 am 확정 | confirmed | ✓/✗ |
| 3b | C02 | 상태 확인 | needs_reselection | ✓/✗ |
| 4 | C02 | 9/10 am 재신청 | received (v2) | ✓/✗ |
| 5 | ADMIN | C02 9/10 am 확정 | confirmed | ✓/✗ |
| 6 | ADMIN | 로그 확인 | 5건 기록 | ✓/✗ |

### 검증 포인트

```
로그인 가능성
├─ 고객 2명 로그인 ✓/✗
└─ 어드민 1명 로그인 (admin 권한) ✓/✗

신청/확정 기능
├─ 신청 성공 (submit_request) ✓/✗
├─ 확정 성공 (confirm_request) ✓/✗
├─ 재신청 성공 (resubmit_request) ✓/✗
└─ 중복 방지 (idempotency) ✓/✗

에러 처리
├─ 조회 오류 표시 ✓/✗
├─ 저장 오류 표시 ✓/✗
└─ 권한 오류 표시 ✓/✗

DB 상태
├─ slots: 42개 유지 ✓/✗
├─ requests: 3개 (C01, C02 v1, C02 v2) ✓/✗
├─ candidates: 5개 ✓/✗
└─ operation_logs: 5건 ✓/✗
```

## 파일 목록

**신규 파일:**
- `src/utils/supabase.ts`: Supabase 클라이언트 + RPC 래퍼

**수정 파일:**
- `src/pages/App.tsx`: 모드 감지, Auth 통합, 오류 표시
- `src/components/CustomerPage.tsx`: Supabase/로컬 분기
- `src/components/AdminPage.tsx`: Supabase/로컬 분기
- `START_HERE.md`: Supabase 설정 가이드

**보존 파일 (변경 없음):**
- `sql/00_supabase.sql`: RPC 정의, 권한 설정
- `src/utils/database.ts`: 로컬 인메모리 DB
- `src/utils/operations.ts`: 로컬 비즈니스 로직
- `src/utils/decide.ts`: 상태 판정 로직

## 알려진 제한사항

1. **Supabase Auth UI 미구현**: 현재 콘솔에서 사용자 생성 후 테스트. 실제 로그인 UI는 별도 구현 필요
2. **테스트 프레임워크**: 로컬 모드 테스트만 완성. Supabase 환경 테스트는 수동으로 진행
3. **브라우저 캐싱**: getSession() 호출 직후 권한이 즉시 반영되지 않을 수 있음 (Supabase SDK 특성)

## 디버깅 팁

**Supabase 모드 감지 확인:**
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
```

**현재 사용자 확인:**
```javascript
const user = await supabaseApi.getCurrentUser();
console.log(user);  // { id: "uuid", email: "..." }
```

**관리자 권한 확인:**
```javascript
const isAdmin = await supabaseApi.getAdminStatus();
console.log(isAdmin);  // true/false
```

**RPC 호출 결과 확인:**
```javascript
const result = await supabaseApi.submitRequest(...);
console.log(result);  // { success: true/false, error?: string, ... }
```

## 참고자료

- [Supabase JavaScript 클라이언트](https://supabase.com/docs/reference/javascript)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase RPC](https://supabase.com/docs/guides/database/functions)
- [PRD.md](./PRD.md): 요구사항 상세
- [AGENTS.md](./AGENTS.md): 구현 규칙
