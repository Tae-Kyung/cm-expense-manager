/**
 * Phase 4 검증: Excel 출력 생성 테스트
 */
import * as fs from "fs";
import * as path from "path";
import { parseInputFile } from "./src/lib/parser";
import { transform } from "./src/lib/transformer";
import { exportToExcel } from "./src/lib/exporter";

const INPUT_PATH = path.resolve(__dirname, "../data/1.input.xls");
const OUTPUT_PATH = path.resolve(__dirname, "../data/4.test-output.xlsx");

async function main() {
  console.log("=== Excel 출력 생성 테스트 ===\n");

  // 1. 파싱
  const inputBuf = fs.readFileSync(INPUT_PATH);
  const transactions = parseInputFile(
    inputBuf.buffer.slice(
      inputBuf.byteOffset,
      inputBuf.byteOffset + inputBuf.byteLength
    )
  );
  console.log(`[파싱] ${transactions.length}건`);

  // 2. 변환
  const result = transform(transactions);
  console.log(
    `[변환] 일반: ${result.general.length}, 금융: ${result.finance.length}, 수익: ${result.income.length}`
  );
  console.log(`[시트명] ${result.sheetName}`);

  // 3. Excel 생성
  const buffer = await exportToExcel(result);
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`\n[저장] ${OUTPUT_PATH}`);
  console.log(`[크기] ${(buffer.length / 1024).toFixed(1)} KB`);

  // 4. 요약 출력
  console.log("\n--- 종합 요약 ---");
  for (const s of result.summary) {
    console.log(
      `  ${s.종합.padEnd(12)}: 합계=${s.합계.toLocaleString().padStart(12)}, 공장=${s.공장.toLocaleString().padStart(12)}, 영업=${s.영업.toLocaleString().padStart(10)}, 연구소=${s.연구소.toLocaleString().padStart(8)}`
    );
  }

  console.log("\n=== 완료 ===");
}

main().catch(console.error);
