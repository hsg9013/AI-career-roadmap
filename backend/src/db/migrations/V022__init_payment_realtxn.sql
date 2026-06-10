-- V022 (003 US3): 결제 실거래 확장 + 정산 원장 + 웹훅 멱등.
-- FR-006(승인·실패·취소·환불·영수증), FR-007(멘토·선배 정산 구조 위 동작).
-- data-model §3: payment 확장, settlement, payment_webhook_event.
-- 멱등 작성(IF [NOT] EXISTS) — 부분 적용/재실행에도 안전(MariaDB).

-- payments 확장: PG 메타·영수증·상태전이 시각.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS pg_provider VARCHAR(20) NOT NULL DEFAULT 'portone' AFTER kind,
  ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 상태 전이 집합 확장(pending→paid→canceled|refunded, pending→failed).
ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_pay_status;
ALTER TABLE payments
  ADD CONSTRAINT chk_pay_status CHECK (status IN ('pending','paid','failed','canceled','refunded'));

-- pg_tx_id 멱등 키 추가 전, 기존 dev-stub 중복 거래ID 를 dedupe(2번째 이후만 id 접미).
UPDATE payments t
JOIN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY pg_tx_id ORDER BY id) AS rn
    FROM payments WHERE pg_tx_id IS NOT NULL
  ) ranked WHERE rn > 1
) dup ON t.id = dup.id
SET t.pg_tx_id = CONCAT(t.pg_tx_id, '-dup', t.id);

-- pg_tx_id 멱등 키(NULL 다중 허용 — 세션 생성 전 pending 대비).
ALTER TABLE payments ADD UNIQUE INDEX IF NOT EXISTS uq_pay_tx (pg_tx_id);

-- 정산 원장(멘토·선배). 기존 mentor_payouts(기간 집계) 위에 누적 이벤트를 기록.
CREATE TABLE IF NOT EXISTS settlement (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payee_user_id BIGINT UNSIGNED NOT NULL,
  basis         VARCHAR(20) NOT NULL,
  source_ref    VARCHAR(80) NOT NULL,
  amount        INT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'accrued',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payee_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_settlement_basis CHECK (basis IN ('fixed','commission')),
  CONSTRAINT chk_settlement_status CHECK (status IN ('accrued','paid')),
  -- 동일 정산 근거(payee+source_ref+basis) 중복 적립 방지 → 멱등.
  UNIQUE KEY uq_settlement_source (payee_user_id, source_ref, basis),
  INDEX idx_settlement_payee (payee_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 웹훅 멱등·감사: pg_event_id 1건당 1행. 재수신은 중복 무시.
CREATE TABLE IF NOT EXISTS payment_webhook_event (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pg_event_id   VARCHAR(120) NOT NULL,
  payload_hash  CHAR(64) NOT NULL,
  processed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webhook_event (pg_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
