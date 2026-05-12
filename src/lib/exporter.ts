import ExcelJS from "exceljs";
import type { TransformResult, Transaction, SummaryRow } from "./types";

const HEADER_COLS = [
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
] as const;

const SUMMARY_HEADER = ["종합", "합계", "공장", "영업", "연구소"] as const;

/**
 * TransformResult를 Excel 파일 버퍼로 변환
 */
export async function exportToExcel(
  result: TransformResult
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(result.sheetName);

  // 열 너비 설정
  ws.columns = [
    { width: 12 }, // A: 관리번호
    { width: 12 }, // B: 발행일
    { width: 14 }, // C: 계정
    { width: 6 },  // D: 코드
    { width: 12 }, // E: 계정과목
    { width: 14 }, // F: 제품명
    { width: 45 }, // G: 세부내용
    { width: 12 }, // H: 입금
    { width: 12 }, // I: 출금
    { width: 8 },  // J: 담당자
    { width: 6 },  // K: 구분
    { width: 35 }, // L: 비고
    { width: 2 },  // M: 빈 열
    { width: 14 }, // N: 종합
    { width: 12 }, // O: 합계
    { width: 12 }, // P: 공장
    { width: 10 }, // Q: 영업
    { width: 10 }, // R: 연구소
  ];

  let currentRow = 1;

  // === 섹션1: 일반경비 ===
  currentRow = writeHeader(ws, currentRow);
  currentRow = writeTransactions(ws, currentRow, result.general);
  // 소계 행
  writeTotalRow(ws, currentRow, result.generalTotal);
  currentRow++;

  // 빈 행
  currentRow += 2;

  // === 섹션2: 금융수수료 ===
  // 타이틀
  const yearMonth = extractYearMonth(result.sheetName);
  ws.getCell(`A${currentRow}`).value = `${yearMonth}_금융수수료`;
  applyTitleStyle(ws, currentRow);
  currentRow++;

  currentRow = writeHeader(ws, currentRow);
  currentRow = writeTransactions(ws, currentRow, result.finance);
  writeTotalRow(ws, currentRow, result.financeTotal);
  currentRow++;

  // 빈 행
  currentRow += 2;

  // === 섹션3: 영업외수익 ===
  ws.getCell(`A${currentRow}`).value = `${yearMonth}_영업외수익`;
  applyTitleStyle(ws, currentRow);
  currentRow++;

  currentRow = writeHeader(ws, currentRow);
  currentRow = writeTransactions(ws, currentRow, result.income);
  // 영업외수익은 입금 합계
  writeIncomeTotalRow(ws, currentRow, result.incomeTotal);

  // === 우측 종합 요약 (N~R열, row 1부터) ===
  writeSummary(ws, result.summary);

  // 버퍼로 변환
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** 헤더 행 작성 */
function writeHeader(ws: ExcelJS.Worksheet, row: number): number {
  HEADER_COLS.forEach((col, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = col;
    cell.font = { bold: true, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };
    cell.border = thinBorder();
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  return row + 1;
}

/** 거래 내역 행 작성 */
function writeTransactions(
  ws: ExcelJS.Worksheet,
  startRow: number,
  transactions: Transaction[]
): number {
  let row = startRow;
  for (const tx of transactions) {
    const values = [
      tx.관리번호,
      tx.발행일,
      tx.계정,
      tx.코드,
      tx.계정과목,
      tx.제품명,
      tx.세부내용,
      tx.입금 || "",
      tx.출금 || "",
      tx.담당자,
      tx.구분,
      tx.비고,
    ];
    values.forEach((val, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = val;
      cell.font = { size: 10 };
      cell.border = thinBorder();
      if (i === 7 || i === 8) {
        // 입금/출금 숫자 포맷
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      }
    });
    row++;
  }
  return row;
}

/** 출금 합계 행 */
function writeTotalRow(ws: ExcelJS.Worksheet, row: number, total: number) {
  const cell = ws.getCell(row, 9); // I열 (출금)
  cell.value = total;
  cell.numFmt = "#,##0";
  cell.font = { bold: true, size: 10 };
  cell.alignment = { horizontal: "right" };
}

/** 입금 합계 행 */
function writeIncomeTotalRow(
  ws: ExcelJS.Worksheet,
  row: number,
  total: number
) {
  const cell = ws.getCell(row, 8); // H열 (입금)
  cell.value = total;
  cell.numFmt = "#,##0";
  cell.font = { bold: true, size: 10 };
  cell.alignment = { horizontal: "right" };
}

/** 종합 요약 작성 (N~R열) */
function writeSummary(ws: ExcelJS.Worksheet, summary: SummaryRow[]) {
  // 헤더
  SUMMARY_HEADER.forEach((col, i) => {
    const cell = ws.getCell(1, 14 + i);
    cell.value = col;
    cell.font = { bold: true, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9E1F2" },
    };
    cell.border = thinBorder();
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  // 데이터 행
  for (let i = 0; i < summary.length; i++) {
    const row = i + 2;
    const s = summary[i];

    // 금융료제외 합계 앞에 빈 행 삽입
    const actualRow =
      s.종합 === "금융료제외 합계" ? row + 1 : s.종합 === "금융수수료" ? row + 1 : s.종합 === "금융료포함 합계" ? row + 1 : row;

    const values = [s.종합, s.합계, s.공장, s.영업, s.연구소];
    values.forEach((val, j) => {
      const cell = ws.getCell(actualRow, 14 + j);
      cell.value = val;
      cell.font = {
        size: 10,
        bold:
          s.종합 === "금융료제외 합계" ||
          s.종합 === "금융수수료" ||
          s.종합 === "금융료포함 합계",
      };
      cell.border = thinBorder();
      if (j >= 1) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      }
    });
  }
}

/** 타이틀 스타일 */
function applyTitleStyle(ws: ExcelJS.Worksheet, row: number) {
  const cell = ws.getCell(`A${row}`);
  cell.font = { bold: true, size: 11 };
}

/** 연월 포맷 변환: "2026년 04월" → "2026.04월" */
function extractYearMonth(sheetName: string): string {
  const match = sheetName.match(/(\d{4})년\s*(\d{2})월/);
  if (!match) return sheetName;
  return `${match[1]}.${match[2]}월`;
}

/** 테두리 스타일 */
function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: "FFD0D0D0" },
  };
  return { top: side, bottom: side, left: side, right: side };
}
