/**
 * Phase 2, 3 검증 스크립트
 * 기존 1.input.xls를 파싱하고 변환한 결과를
 * 기존 3.output.xlsx와 비교하여 정합성을 검증한다.
 */
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { parseInputFile, detectYearMonth } from "./src/lib/parser";
import { transform } from "./src/lib/transformer";
import type { TransformResult } from "./src/lib/types";

const INPUT_PATH = path.resolve(__dirname, "../data/1.input.xls");
const OUTPUT_PATH = path.resolve(__dirname, "../data/3.output.xlsx");

function main() {
  console.log("=== Phase 2, 3 검증 시작 ===\n");

  // 1. 입력 파일 파싱
  const inputBuf = fs.readFileSync(INPUT_PATH);
  const transactions = parseInputFile(
    inputBuf.buffer.slice(
      inputBuf.byteOffset,
      inputBuf.byteOffset + inputBuf.byteLength
    )
  );
  console.log(`[파싱] 총 ${transactions.length}건 파싱 완료`);

  // 2. 연월 감지
  const yearMonth = detectYearMonth(transactions);
  console.log(`[연월] ${yearMonth}`);

  // 3. 변환
  const result = transform(transactions);
  console.log(
    `[변환] 일반경비: ${result.general.length}건, 금융수수료: ${result.finance.length}건, 영업외수익: ${result.income.length}건`
  );
  console.log(
    `[소계] 일반: ${result.generalTotal.toLocaleString()}, 금융: ${result.financeTotal.toLocaleString()}, 수익: ${result.incomeTotal.toLocaleString()}`
  );

  // 4. 기존 output 파일과 비교
  console.log("\n=== 기존 output과 비교 ===\n");
  compareWithOutput(result);
}

function compareWithOutput(result: TransformResult) {
  const outputBuf = fs.readFileSync(OUTPUT_PATH);
  const wb = XLSX.read(outputBuf, { type: "buffer" });
  const lastSheet = wb.SheetNames[wb.SheetNames.length - 1];
  const sheet = wb.Sheets[lastSheet];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
  });

  // --- 종합 요약 비교 (col 13~17) ---
  console.log("--- 종합 요약 비교 ---");
  const expectedSummary: Record<
    string,
    { 합계: number; 공장: number; 영업: number; 연구소: number }
  > = {};

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const label = String(row[13] ?? "").trim();
    if (!label || label === "종합") continue;

    expectedSummary[label] = {
      합계: Number(row[14]) || 0,
      공장: Number(row[15]) || 0,
      영업: Number(row[16]) || 0,
      연구소: Number(row[17]) || 0,
    };
  }

  let pass = 0;
  let fail = 0;

  for (const row of result.summary) {
    const expected = expectedSummary[row.종합];
    if (!expected) {
      console.log(
        `  [?] "${row.종합}" - 기존 output에 없음 (계산값: 합계=${row.합계})`
      );
      continue;
    }

    const match =
      row.합계 === expected.합계 &&
      row.공장 === expected.공장 &&
      row.영업 === expected.영업 &&
      row.연구소 === expected.연구소;

    if (match) {
      console.log(`  [OK] ${row.종합}: ${row.합계.toLocaleString()}`);
      pass++;
    } else {
      console.log(`  [FAIL] ${row.종합}:`);
      console.log(
        `    계산: 합계=${row.합계}, 공장=${row.공장}, 영업=${row.영업}, 연구소=${row.연구소}`
      );
      console.log(
        `    기대: 합계=${expected.합계}, 공장=${expected.공장}, 영업=${expected.영업}, 연구소=${expected.연구소}`
      );
      console.log(
        `    차이: 합계=${row.합계 - expected.합계}, 공장=${row.공장 - expected.공장}, 영업=${row.영업 - expected.영업}, 연구소=${row.연구소 - expected.연구소}`
      );
      fail++;
    }
  }

  // --- 거래 건수 비교 ---
  console.log("\n--- 거래 건수 비교 ---");

  let outputGeneralCount = 0;
  let outputFinanceCount = 0;
  let outputIncomeCount = 0;
  let section = "general";

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const col0 = String(row[0] ?? "").trim();
    const col2 = String(row[2] ?? "").trim();

    if (col0.includes("금융수수료")) {
      section = "finance";
      continue;
    }
    if (col0.includes("영업외수익")) {
      section = "income";
      continue;
    }
    if (col0 === "관리번호") continue;
    if (!col0 || !col2) continue;

    if (section === "general") outputGeneralCount++;
    else if (section === "finance") outputFinanceCount++;
    else if (section === "income") outputIncomeCount++;
  }

  console.log(
    `  일반경비: 계산=${result.general.length}, 기대=${outputGeneralCount} ${result.general.length === outputGeneralCount ? "[OK]" : "[FAIL]"}`
  );
  console.log(
    `  금융수수료: 계산=${result.finance.length}, 기대=${outputFinanceCount} ${result.finance.length === outputFinanceCount ? "[OK]" : "[FAIL]"}`
  );
  console.log(
    `  영업외수익: 계산=${result.income.length}, 기대=${outputIncomeCount} ${result.income.length === outputIncomeCount ? "[OK]" : "[FAIL]"}`
  );

  console.log(`\n=== 결과: ${pass} PASS, ${fail} FAIL ===`);
}

main();
