-- 창명제어기술 경비 정리 시스템 DB 스키마
-- 테이블명 접두사: mgmt_

-- 업로드 이력
CREATE TABLE IF NOT EXISTS mgmt_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,           -- 예: "2026년 04월"
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'uploaded'      -- uploaded | processed | completed
    CHECK (status IN ('uploaded', 'processed', 'completed')),
  general_count INTEGER,
  finance_count INTEGER,
  income_count INTEGER,
  excluded_count INTEGER,
  general_total BIGINT,
  finance_total BIGINT,
  income_total BIGINT
);

-- 거래 내역
CREATE TABLE IF NOT EXISTS mgmt_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES mgmt_uploads(id) ON DELETE CASCADE,
  관리번호 TEXT NOT NULL,
  발행일 TEXT,
  계정 TEXT,
  코드 TEXT,
  계정과목 TEXT,
  제품명 TEXT,
  세부내용 TEXT,
  입금 BIGINT DEFAULT 0,
  출금 BIGINT DEFAULT 0,
  담당자 TEXT,
  구분 TEXT,                          -- 공장 | 영업 | 연구소
  비고 TEXT,
  section TEXT NOT NULL DEFAULT 'general'  -- general | finance | income | excluded
    CHECK (section IN ('general', 'finance', 'income', 'excluded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_mgmt_transactions_upload
  ON mgmt_transactions(upload_id);
CREATE INDEX IF NOT EXISTS idx_mgmt_transactions_section
  ON mgmt_transactions(upload_id, section);
CREATE INDEX IF NOT EXISTS idx_mgmt_uploads_year_month
  ON mgmt_uploads(year_month);

-- RLS (Row Level Security) - 필요시 활성화
-- ALTER TABLE mgmt_uploads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE mgmt_transactions ENABLE ROW LEVEL SECURITY;
