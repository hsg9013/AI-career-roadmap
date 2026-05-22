-- pioneer16 DB·유저는 docker-compose 환경변수로 이미 생성됨.
-- 본 스크립트는 추가 보강 작업이 있을 때 사용.
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 권한 보강 (mariadb env 외에 명시적 GRANT)
CREATE USER IF NOT EXISTS 'pioneer16'@'%' IDENTIFIED BY 'pioneer26';
GRANT ALL PRIVILEGES ON pioneer16.* TO 'pioneer16'@'%';
FLUSH PRIVILEGES;
