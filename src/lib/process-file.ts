import { parseInputFile } from "./parser";
import { transform } from "./transformer";
import type { Transaction, TransformResult } from "./types";

/**
 * 거래를 4가지 섹션으로 분류 (transformer.ts의 classifyTransaction과 동일 로직)
 * excluded 항목도 반환하기 위해 별도 함수로 분리
 */
function classifyTransaction(
  tx: Transaction
): "general" | "finance" | "income" | "excluded" {
  if (tx.계정과목 === "금융수수료") return "finance";

  if (tx.계정 === "입금") {
    if (tx.계정과목 === "정부지원사업") return "income";
    if (tx.계정과목 === "회사내입금" && tx.제품명 === "태양광발전소")
      return "income";
    return "excluded";
  }

  if (tx.계정 === "기타") return "excluded";
  if (tx.계정 === "자산구입비") return "excluded";

  if (tx.계정 === "세금과공과") {
    const excluded = ["부가세환급", "근로소득세", "주민세", "부가가치세"];
    if (excluded.includes(tx.계정과목)) return "excluded";
  }

  if (tx.계정 === "복리후생비" && tx.계정과목 === "보험료") {
    if (tx.세부내용.includes("종신보험")) return "excluded";
  }

  if (tx.계정 === "보험료" && tx.계정과목 === "손해보험") {
    if (tx.세부내용.includes("건강보험")) return "excluded";
  }

  if (tx.계정 === "노무비" && tx.계정과목 === "퇴직급여") return "excluded";
  if (tx.계정 === "원재료비" && tx.계정과목 === "자재구입비") return "excluded";
  if (tx.계정 === "경상연구개발비" && tx.계정과목 === "기타") return "excluded";

  return "general";
}

export interface ProcessResult {
  result: TransformResult;
  excluded: Transaction[];
}

/**
 * 파일 버퍼를 받아 파싱 + 변환 + 경비제외 목록 반환
 */
export function processFile(buffer: ArrayBuffer): ProcessResult {
  const transactions = parseInputFile(buffer);
  const result = transform(transactions);

  // excluded 항목 따로 수집
  const excluded: Transaction[] = [];
  for (const tx of transactions) {
    if (classifyTransaction(tx) === "excluded") {
      excluded.push(tx);
    }
  }

  return { result, excluded };
}
