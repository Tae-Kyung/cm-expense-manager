/** 입력 파일에서 파싱된 거래 내역 1건 */
export interface Transaction {
  관리번호: string;
  발행일: string;
  계정: string;
  코드: string;
  계정과목: string;
  제품명: string;
  세부내용: string;
  입금: number;
  출금: number;
  담당자: string;
  구분: string; // 공장 | 영업 | 연구소
  비고: string;
}

/** 우측 종합 요약 1행 */
export interface SummaryRow {
  종합: string;
  합계: number;
  공장: number;
  영업: number;
  연구소: number;
}

/** 변환 결과 전체 */
export interface TransformResult {
  /** 년월 (예: "2026년 04월") */
  sheetName: string;
  /** 섹션1: 일반경비 (계정명 가나다순) */
  general: Transaction[];
  /** 섹션2: 금융수수료 */
  finance: Transaction[];
  /** 섹션3: 영업외수익 (입금) */
  income: Transaction[];
  /** 우측 종합 요약 */
  summary: SummaryRow[];
  /** 섹션별 소계 */
  generalTotal: number;
  financeTotal: number;
  incomeTotal: number;
}
