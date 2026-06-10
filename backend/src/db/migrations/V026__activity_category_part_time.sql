-- V026 (004 US1/G1): 활동 카테고리에 '아르바이트(part_time)' 추가.
-- 보유 스펙(자격증·수상·인턴십)은 기존 activities 카테고리를 재사용하고, 누락된 아르바이트만 보강한다.
-- 기존 CHECK 제약을 교체한다(데이터 보존, 추가만).

ALTER TABLE activities DROP CONSTRAINT chk_activity_category;

ALTER TABLE activities
  ADD CONSTRAINT chk_activity_category CHECK (
    category IN (
      'course','project','club','volunteer','contest','external',
      'internship','award','certification','part_time'
    )
  );
