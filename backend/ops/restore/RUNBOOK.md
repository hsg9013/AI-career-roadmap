# 복구 런북 (003 US8 / FR-015)

**목표**: 데이터 손실 상황에서 **24시간 이내** 서비스 데이터 복원. 일일 논리 백업(`mysqldump`)으로부터 복구한다.

## 전제
- 백업은 `pnpm --filter backend backup:run`(cron 일 1회)으로 `BACKUP_DIR`(기본 `backend/ops/backups`)에 생성되며, `backup_run` 테이블에 이력이 남는다.
- 마지막 성공 백업 시각은 `GET /v1/ops/health`의 `lastBackupAt` 또는 `backup_run`(status='success') 최신 행으로 확인한다.

## 복구 절차
1. **사고 선언·차단**: 앱 트래픽 차단(또는 점검 모드), 추가 쓰기 중단.
2. **백업 선택**: `BACKUP_DIR`에서 가장 최근 `*.sql`(또는 사고 직전 시점) 선택. 무결성: 파일 크기·`backup_run.size_bytes` 대조.
3. **대상 DB 준비**: 복구 대상 인스턴스(가능하면 standby 승격본) 확보. 운영 표준값(포트·DB명) 유지.
4. **복원 실행**:
   ```bash
   # 주의: 대상 DB를 덮어쓴다. 운영 반영 전 스테이징에서 1회 리허설.
   MYSQL_PWD="$DB_PASSWORD" mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" "$DB_NAME" < <백업파일>.sql
   ```
5. **마이그레이션 정합성**: `pnpm --filter backend migrate:status`로 `schema_migrations`가 코드 버전과 일치하는지 확인. 필요 시 `migrate:up`.
6. **검증**: `GET /v1/ops/health` → `status=ok`, 핵심 플로우(로그인→진단→로드맵) 스모크.
7. **재개·사후**: 트래픽 재개, `monitor_alert` 미해결 경보 확인·해소, 사고 기록.

## 리허설 (정기)
- 분기 1회 스테이징에서 위 절차로 **24h 내 완료** 측정. 결과를 운영 기록에 남긴다.
- 리허설은 운영 DB가 아닌 별도 인스턴스 대상으로만 수행한다.

## 단일 장애점(SPOF) 보완 — standby
- 운영 MariaDB는 단일 인스턴스이므로 복제(standby)를 둔다(`infra/` 참고). 마스터 장애 시 standby 승격 후 위 5~6단계로 정합성·검증.
