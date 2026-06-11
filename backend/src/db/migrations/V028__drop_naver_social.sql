-- V028: 네이버 소셜 로그인 기능 제거(기획 방향)에 따른 소셜 식별 테이블 정리.
--   • social_identity (V024): provider IN ('naver') 전용 — 네이버 외 사용처 없음.
--   • social_accounts (V001): 코드에서 미사용(구형 스키마)이었음.
-- 두 테이블 모두 users 만 참조(FK out)하고 이를 참조하는 테이블은 없어 드롭이 안전하다.
DROP TABLE IF EXISTS social_identity;
DROP TABLE IF EXISTS social_accounts;
