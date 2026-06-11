-- V029: 교육·활동 플랫폼(edu_platform) 파트너 로그인 역할 추가.
--   기존 users.role CHECK 에 'edu_platform' 추가 → 제휴사 포털 로그인 가능.
ALTER TABLE users DROP CONSTRAINT chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role
  CHECK (role IN ('student','mentor','university','enterprise','admin','edu_platform'));
