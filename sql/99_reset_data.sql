-- 데이터 초기화 (신청 기록만 지움, 42슬롯은 그대로 둠)
-- Supabase SQL Editor에서 실행하세요.
-- 주의: 신청·확정·기록이 전부 사라집니다. 되돌릴 수 없습니다.

BEGIN;

-- 1. 신청 관련 기록 지우기 (참조 순서대로)
DELETE FROM confirmations;
DELETE FROM candidates;
DELETE FROM requests;
DELETE FROM operation_logs;

-- 2. 슬롯은 지우지 않고 '가능' 상태로만 되돌리기
UPDATE slots
SET status = 'available',
    confirmed_by = NULL,
    confirmed_at = NULL,
    updated_at = NOW();

COMMIT;

-- 3. 확인: 42 / 2026-09-09 / 2026-09-22 / 0 / 0 이 나와야 정상
SELECT
  (SELECT COUNT(*) FROM slots)                                AS 슬롯수,
  (SELECT MIN(date) FROM slots)                               AS 첫날,
  (SELECT MAX(date) FROM slots)                               AS 마지막날,
  (SELECT COUNT(*) FROM slots WHERE status = 'confirmed')     AS 마감된슬롯,
  (SELECT COUNT(*) FROM requests)                             AS 신청수;
