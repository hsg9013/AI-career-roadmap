# 백업·복구 런북 (T065 / SC-012)

**목표**: 월 가용성 ≥ 99.5%, 장애 시 핵심 데이터 **24시간 이내 복구**. 단일 MariaDB 인스턴스의 SPOF를 일일 백업 + 복구 절차로 보완(향후 read-replica 도입 시 갱신).

## 1. 헬스 모니터링

- `GET /healthz` — 프로세스 생존 (200 고정)
- `GET /readyz` — 의존성 ping. `db`/`redis` 실제 점검, `s3`/`llm` 설정 판정.
  - 정상: `200 {status:"ok"}` / 비정상: `503 {status:"degraded", deps:{...}}`
- 외부 모니터(uptime check)는 `/readyz` 를 60초 간격 폴링, 2회 연속 503 시 알림.

## 2. 일일 백업 (논리 덤프 + 스냅샷)

```bash
# 매일 03:00 (cron). 7일 보관 + 주간 1회 장기 보관.
DATE=$(date +%F)
mysqldump --single-transaction --routines --triggers \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" pioneer16 \
  | gzip > "/backups/pioneer16-$DATE.sql.gz"
find /backups -name 'pioneer16-*.sql.gz' -mtime +7 -delete
```

- MinIO 객체(이력서·미션 제출물)는 `mc mirror` 로 별도 버킷/리전 미러링.
- 백업 무결성: 주 1회 복구 리허설(아래 4번)로 검증.

## 3. 복구 절차 (RTO ≤ 24h)

1. 인프라 기동: `./check_project.sh start` (OrbStack mariadb/redis/minio)
2. 최신 정상 백업 선택 후 복원:
   ```bash
   gunzip < /backups/pioneer16-<DATE>.sql.gz | \
     mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" pioneer16
   ```
3. 마이그레이션 정합성 확인: `pnpm --filter backend migrate:status` (전부 applied)
4. 앱 재기동 + 검증: `./check_project.sh restart` → `/readyz` 200 확인
5. 스모크: 로그인 → 진단 → 로드맵 happy-path (e2e.quickstart 시나리오)

## 4. 주간 복구 리허설

- 스테이징에 최신 백업 복원 → `pnpm --filter backend test` 통과 확인 → 결과 기록.

## 5. 보존·정리

- 졸업 후 보존기간(2년) 경과 데이터: `pnpm --filter backend retention:run` (cron 월 1회). 익명화 처리, `audit_logs` 기록.
