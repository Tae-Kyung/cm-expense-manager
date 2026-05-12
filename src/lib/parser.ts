import * as XLSX from "xlsx";
import type { Transaction } from "./types";

/** 입력 컬럼 순서 (1.input.xls 기준) */
const INPUT_COLUMNS = [
  "관리번호",
  "발행일",
  "계정",
  "코드",
  "계정과목",
  "제품명",
  "세부내용",
  "입금",
  "출금",
  "담당자",
  "구분",
  "비고",
  "전월이월",
  "월입합계",
  "증빙자료",
  "월출합계",
  "잔액",
  "카드전표",
  "계좌번호",
  "첨부기타",
] as const;

/**
 * .xls 또는 .xlsx 파일 버퍼를 파싱하여 Transaction 배열로 변환
 */
export function parseInputFile(buffer: ArrayBuffer): Transaction[] {
  const workbook = XLSX.read(buffer, { type: "array", codepage: 949 });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // 시트를 2차원 배열로 변환 (헤더 포함)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (rows.length < 2) {
    throw new Error("입력 파일에 데이터가 없습니다.");
  }

  // 첫 행은 헤더 - 스킵
  const dataRows = rows.slice(1);

  const transactions: Transaction[] = [];

  for (const row of dataRows) {
    const 관리번호 = String(row[0] ?? "").trim();
    const 계정 = String(row[2] ?? "").trim();

    // 마지막 합계 행 감지: 관리번호가 숫자이거나 계정이 비어있으면 스킵
    if (!관리번호 || !계정) continue;
    if (/^\d+$/.test(관리번호)) continue;

    const tx: Transaction = {
      관리번호,
      발행일: formatDate(row[1]),
      계정,
      코드: String(row[3] ?? "").replace(/\.0$/, ""),
      계정과목: String(row[4] ?? "").trim(),
      제품명: String(row[5] ?? "").trim(),
      세부내용: String(row[6] ?? "").trim(),
      입금: toNumber(row[7]),
      출금: toNumber(row[8]),
      담당자: String(row[9] ?? "").trim(),
      구분: normalizeSection(String(row[10] ?? "").trim()),
      비고: String(row[11] ?? "").trim(),
    };

    transactions.push(tx);
  }

  return transactions;
}

/** 발행일을 YYYYMMDD 문자열로 정규화 */
function formatDate(val: unknown): string {
  if (val == null || val === "") return "";
  const num = Number(val);
  if (!isNaN(num) && num > 20000000) {
    return String(Math.floor(num));
  }
  return String(val).trim();
}

/** 숫자로 변환 (빈 값은 0) */
function toNumber(val: unknown): number {
  if (val == null || val === "") return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : Math.round(num);
}

/** 구분값 정규화 */
function normalizeSection(val: string): string {
  if (val === "공장" || val === "공통") return "공장";
  if (val === "영업") return "영업";
  if (val === "연구소") return "연구소";
  return val;
}

/**
 * 입력 데이터에서 연월을 추출 (예: "2026년 04월")
 * 발행일 기준으로 가장 많이 등장하는 월을 사용
 */
export function detectYearMonth(transactions: Transaction[]): string {
  const monthCount: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.발행일.length >= 6) {
      const ym = tx.발행일.substring(0, 6); // YYYYMM
      monthCount[ym] = (monthCount[ym] || 0) + 1;
    }
  }

  const sorted = Object.entries(monthCount).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    throw new Error("발행일에서 연월을 추출할 수 없습니다.");
  }

  const ym = sorted[0][0]; // 가장 많이 등장하는 YYYYMM
  const year = ym.substring(0, 4);
  const month = ym.substring(4, 6);
  return `${year}년 ${month}월`;
}
