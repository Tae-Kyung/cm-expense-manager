import type { Transaction, SummaryRow, TransformResult } from "./types";
import { detectYearMonth } from "./parser";

/** 종합 요약에 사용되는 고정 계정 카테고리 (순서 고정) */
const SUMMARY_CATEGORIES = [
  "A/S비",
  "감가상각비",
  "경상연구개발비",
  "광고선전비",
  "교육훈련비",
  "교통비",
  "국내출장비",
  "도서인쇄비",
  "보험료",
  "복리후생비",
  "세금과공과",
  "소모품비",
  "수도광열비",
  "수선비",
  "운반비",
  "접대비",
  "지급수수료",
  "차량관리비",
  "통신비",
  "해외출장비",
  "판매촉진비",
  "폐기비용",
  "원재료비",
  "노무비",
  "자산구입비",
  "지급임차료",
  "협회비",
  "기타",
] as const;

/**
 * 거래를 4가지 섹션으로 분류
 * - general: 일반경비 (출력 섹션1)
 * - finance: 금융수수료 (출력 섹션2)
 * - income: 영업외수익 (출력 섹션3)
 * - excluded: 경비제외 (출력에서 제외)
 */
type Section = "general" | "finance" | "income" | "excluded";

function classifyTransaction(tx: Transaction): Section {
  // 1. 금융수수료 → 섹션2
  if (tx.계정과목 === "금융수수료") {
    return "finance";
  }

  // 2. 입금 분류
  if (tx.계정 === "입금") {
    // 영업외수익: 정부지원사업, 태양광발전소 회사내입금
    if (tx.계정과목 === "정부지원사업") return "income";
    if (tx.계정과목 === "회사내입금" && tx.제품명 === "태양광발전소") return "income";
    // 나머지 입금 (의료기기임대, 잡수익, 수수료정산, 배당금수익, 기타 회사내입금)
    return "excluded";
  }

  // 3. 계정 단위 제외
  if (tx.계정 === "기타") return "excluded";
  if (tx.계정 === "자산구입비") return "excluded";

  // 4. 계정과목 단위 제외
  // 세금과공과: 부가세환급, 근로소득세, 주민세, 부가가치세 → 제외
  if (tx.계정 === "세금과공과") {
    const excluded = ["부가세환급", "근로소득세", "주민세", "부가가치세"];
    if (excluded.includes(tx.계정과목)) return "excluded";
  }

  // 복리후생비 > 보험료 → 종신보험(개인)만 제외, 단체보험은 포함
  if (tx.계정 === "복리후생비" && tx.계정과목 === "보험료") {
    if (tx.세부내용.includes("종신보험")) return "excluded";
  }

  // 보험료 > 손해보험 → 건강보험(개인)만 제외, 운전자보험 등은 포함
  if (tx.계정 === "보험료" && tx.계정과목 === "손해보험") {
    if (tx.세부내용.includes("건강보험")) return "excluded";
  }

  // 노무비 > 퇴직급여 → 제외
  if (tx.계정 === "노무비" && tx.계정과목 === "퇴직급여") return "excluded";

  // 원재료비 > 자재구입비 → 제외
  if (tx.계정 === "원재료비" && tx.계정과목 === "자재구입비") return "excluded";

  // 경상연구개발비 > 기타 → 제외
  if (tx.계정 === "경상연구개발비" && tx.계정과목 === "기타") return "excluded";

  // 5. 나머지 → 일반경비
  return "general";
}

/**
 * 파싱된 거래내역을 변환하여 출력 결과를 생성
 */
export function transform(transactions: Transaction[]): TransformResult {
  const sheetName = detectYearMonth(transactions);

  // 1. 섹션 분류
  const finance: Transaction[] = [];
  const income: Transaction[] = [];
  const general: Transaction[] = [];
  const excluded: Transaction[] = [];

  for (const tx of transactions) {
    const section = classifyTransaction(tx);
    switch (section) {
      case "finance":
        finance.push(tx);
        break;
      case "income":
        income.push(tx);
        break;
      case "excluded":
        excluded.push(tx);
        break;
      default:
        general.push(tx);
        break;
    }
  }

  // 2. 일반경비: 계정명 기준 가나다순 정렬, 같은 계정 내에서는 발행일순
  general.sort((a, b) => {
    const cmp = a.계정.localeCompare(b.계정, "ko");
    if (cmp !== 0) return cmp;
    return a.발행일.localeCompare(b.발행일);
  });

  // 3. 종합 요약 피벗 생성
  const summary = buildSummary(general, finance);

  // 4. 소계 계산
  const generalTotal = general.reduce((sum, tx) => sum + tx.출금, 0);
  const financeTotal = finance.reduce((sum, tx) => sum + tx.출금, 0);
  const incomeTotal = income.reduce((sum, tx) => sum + tx.입금, 0);

  return {
    sheetName,
    general,
    finance,
    income,
    summary,
    generalTotal,
    financeTotal,
    incomeTotal,
  };
}

/**
 * 종합 요약 피벗 테이블 생성
 */
function buildSummary(
  general: Transaction[],
  finance: Transaction[]
): SummaryRow[] {
  // 계정별/구분별 출금 집계
  const pivot: Record<
    string,
    { 합계: number; 공장: number; 영업: number; 연구소: number }
  > = {};

  for (const cat of SUMMARY_CATEGORIES) {
    pivot[cat] = { 합계: 0, 공장: 0, 영업: 0, 연구소: 0 };
  }

  for (const tx of general) {
    const cat = tx.계정;
    if (!pivot[cat]) {
      // 알 수 없는 계정은 '기타'로 분류
      pivot["기타"].합계 += tx.출금;
      addToSection(pivot["기타"], tx.구분, tx.출금);
    } else {
      pivot[cat].합계 += tx.출금;
      addToSection(pivot[cat], tx.구분, tx.출금);
    }
  }

  // 카테고리별 요약 행 생성
  const rows: SummaryRow[] = SUMMARY_CATEGORIES.map((cat) => ({
    종합: cat,
    합계: pivot[cat].합계,
    공장: pivot[cat].공장,
    영업: pivot[cat].영업,
    연구소: pivot[cat].연구소,
  }));

  // 금융료제외 합계
  const exFinance: SummaryRow = {
    종합: "금융료제외 합계",
    합계: rows.reduce((s, r) => s + r.합계, 0),
    공장: rows.reduce((s, r) => s + r.공장, 0),
    영업: rows.reduce((s, r) => s + r.영업, 0),
    연구소: rows.reduce((s, r) => s + r.연구소, 0),
  };

  // 금융수수료 합계
  const finSummary: SummaryRow = {
    종합: "금융수수료",
    합계: finance.reduce((s, tx) => s + tx.출금, 0),
    공장: finance
      .filter((tx) => tx.구분 === "공장")
      .reduce((s, tx) => s + tx.출금, 0),
    영업: finance
      .filter((tx) => tx.구분 === "영업")
      .reduce((s, tx) => s + tx.출금, 0),
    연구소: finance
      .filter((tx) => tx.구분 === "연구소")
      .reduce((s, tx) => s + tx.출금, 0),
  };

  // 금융료포함 합계
  const incFinance: SummaryRow = {
    종합: "금융료포함 합계",
    합계: exFinance.합계 + finSummary.합계,
    공장: exFinance.공장 + finSummary.공장,
    영업: exFinance.영업 + finSummary.영업,
    연구소: exFinance.연구소 + finSummary.연구소,
  };

  rows.push(exFinance, finSummary, incFinance);

  return rows;
}

function addToSection(
  target: { 공장: number; 영업: number; 연구소: number },
  section: string,
  amount: number
) {
  if (section === "공장" || section === "공통") {
    target.공장 += amount;
  } else if (section === "영업") {
    target.영업 += amount;
  } else if (section === "연구소") {
    target.연구소 += amount;
  } else {
    target.공장 += amount;
  }
}
