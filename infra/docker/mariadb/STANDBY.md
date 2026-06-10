# MariaDB Standby (003 US8 / FR-016) — 단일 장애점 보완

운영 MariaDB는 단일 인스턴스(SPOF)다. 가용성 99.5% 목표를 위해 **비동기 복제 standby**를 둔다. 본 문서는 구성 절차이며, 실제 프로비저닝은 운영 환경에서 수행한다(개발 compose는 단일 노드 유지).

## 구성 개요
- **primary**: 기존 `mariadb` 서비스(바이너리 로그 활성).
- **standby**: 동일 이미지의 읽기 전용 복제본. primary 장애 시 승격(promote)하여 서비스 연결을 전환.

## primary 설정
```ini
# my.cnf (primary)
[mariadbd]
server_id              = 1
log_bin                = mysql-bin
binlog_format          = ROW
```
복제 계정:
```sql
CREATE USER 'repl'@'%' IDENTIFIED BY '<repl_pw>';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';
```

## standby 설정
```ini
# my.cnf (standby)
[mariadbd]
server_id   = 2
read_only   = ON
```
복제 시작:
```sql
CHANGE MASTER TO
  MASTER_HOST='mariadb',
  MASTER_USER='repl',
  MASTER_PASSWORD='<repl_pw>',
  MASTER_USE_GTID=slave_pos;
START SLAVE;
SHOW SLAVE STATUS\G   -- Slave_IO_Running=Yes, Slave_SQL_Running=Yes 확인
```

## compose (운영 프로파일 예시)
`infra/docker/docker-compose.yml`에 `mariadb-standby` 서비스를 `profiles: [ha]`로 추가하고, primary는 위 binlog 옵션을 켠다. 개발에서는 `ha` 프로파일을 띄우지 않는다.

## 장애 전환(Failover) — RUNBOOK 연계
1. primary 장애 감지(`monitor_alert` component=db, `GET /v1/ops/health` status=down).
2. standby 복제 지연 확인 후 `STOP SLAVE; RESET SLAVE ALL; SET GLOBAL read_only=OFF;`로 승격.
3. 앱 DB 접속을 승격 노드로 전환(네트워크 표준값·DB명 유지).
4. `backend/ops/restore/RUNBOOK.md` 5~6단계(마이그레이션 정합성·스모크)로 검증.

> 상태: 절차 문서화 완료. 실제 복제 노드 프로비저닝·페일오버 리허설은 운영 환경 작업으로 분리.
