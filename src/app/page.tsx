"use client";

import { useState, useCallback } from "react";
import type { TransformResult, Transaction, SummaryRow } from "@/lib/types";

type ViewTab = "general" | "finance" | "income" | "excluded" | "summary";

interface ProcessResponse {
  result: TransformResult;
  excluded: Transaction[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransformResult | null>(null);
  const [excluded, setExcluded] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>("general");
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".xls") || f.name.endsWith(".xlsx"))) {
      setFile(f);
      setError(null);
    } else {
      setError("xls 또는 xlsx 파일만 업로드 가능합니다.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/process", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "처리 중 오류가 발생했습니다.");
      }

      const data: ProcessResponse = await res.json();
      setResult(data.result);
      setExcluded(data.excluded);
      setActiveTab("general");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "다운로드 실패");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const rawFilename = res.headers.get("X-Filename") || "output.xlsx";
      a.download = decodeURIComponent(rawFilename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "다운로드 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      {/* 업로드 영역 */}
      <section className="bg-white rounded-lg border border-zinc-200 p-6">
        <h2 className="text-base font-semibold text-zinc-700 mb-4">
          1. 파일 업로드
        </h2>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-zinc-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
        >
          {file ? (
            <p className="text-zinc-700">
              <span className="font-medium">{file.name}</span>
              <span className="text-zinc-400 ml-2">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </p>
          ) : (
            <p className="text-zinc-400">
              xls/xlsx 파일을 드래그하거나 클릭하여 선택하세요
            </p>
          )}
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            className="hidden"
            id="file-input"
          />
          <label
            htmlFor="file-input"
            className="inline-block mt-3 px-4 py-2 bg-zinc-100 text-zinc-600 text-sm rounded-md cursor-pointer hover:bg-zinc-200"
          >
            파일 선택
          </label>
        </div>

        {error && (
          <p className="mt-3 text-red-500 text-sm">{error}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleProcess}
            disabled={!file || loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "처리 중..." : "변환 실행"}
          </button>
          {result && (
            <button
              onClick={handleDownload}
              disabled={loading}
              className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-40"
            >
              Excel 다운로드
            </button>
          )}
        </div>
      </section>

      {/* 결과 영역 */}
      {result && (
        <section className="bg-white rounded-lg border border-zinc-200 flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-zinc-200 px-4">
            <h2 className="text-base font-semibold text-zinc-700 py-3">
              2. 변환 결과 — {result.sheetName}
            </h2>
            <div className="flex gap-1 -mb-px">
              {(
                [
                  ["general", `일반경비 (${result.general.length})`],
                  ["finance", `금융수수료 (${result.finance.length})`],
                  ["income", `영업외수익 (${result.income.length})`],
                  ["excluded", `경비제외 (${excluded.length})`],
                  ["summary", "종합 요약"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {activeTab === "summary" ? (
              <SummaryTable summary={result.summary} />
            ) : (
              <TransactionTable
                transactions={
                  activeTab === "general"
                    ? result.general
                    : activeTab === "finance"
                      ? result.finance
                      : activeTab === "income"
                        ? result.income
                        : excluded
                }
                showIncome={activeTab === "income"}
              />
            )}
          </div>

          {/* 하단 소계 */}
          <div className="border-t border-zinc-200 px-4 py-3 bg-zinc-50 text-sm text-zinc-600 flex gap-6">
            <span>
              일반경비 출금합계:{" "}
              <strong>{result.generalTotal.toLocaleString()}</strong>
            </span>
            <span>
              금융수수료:{" "}
              <strong>{result.financeTotal.toLocaleString()}</strong>
            </span>
            <span>
              영업외수익 입금합계:{" "}
              <strong>{result.incomeTotal.toLocaleString()}</strong>
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

function TransactionTable({
  transactions,
  showIncome,
}: {
  transactions: Transaction[];
  showIncome?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <p className="p-8 text-center text-zinc-400">데이터가 없습니다.</p>
    );
  }

  return (
    <table className="w-full text-sm text-zinc-900">
      <thead className="bg-zinc-100 sticky top-0 z-10">
        <tr>
          {[
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
          ].map((h) => (
            <th
              key={h}
              className="px-3 py-2.5 text-left font-bold text-zinc-800 border-b-2 border-zinc-300 whitespace-nowrap"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx, i) => (
          <tr
            key={tx.관리번호 + i}
            className="hover:bg-blue-50 border-b border-zinc-200"
          >
            <td className="px-3 py-2 whitespace-nowrap font-medium">{tx.관리번호}</td>
            <td className="px-3 py-2 whitespace-nowrap">{tx.발행일}</td>
            <td className="px-3 py-2 whitespace-nowrap">{tx.계정}</td>
            <td className="px-3 py-2 whitespace-nowrap">{tx.코드}</td>
            <td className="px-3 py-2 whitespace-nowrap">{tx.계정과목}</td>
            <td className="px-3 py-2 whitespace-nowrap">{tx.제품명}</td>
            <td className="px-3 py-2 max-w-sm truncate" title={tx.세부내용}>
              {tx.세부내용}
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap font-mono">
              {tx.입금 ? tx.입금.toLocaleString() : ""}
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap font-mono">
              {tx.출금 ? tx.출금.toLocaleString() : ""}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{tx.담당자}</td>
            <td className="px-3 py-2 whitespace-nowrap">{tx.구분}</td>
            <td className="px-3 py-2 max-w-sm truncate" title={tx.비고}>
              {tx.비고}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryTable({ summary }: { summary: SummaryRow[] }) {
  return (
    <table className="w-full text-sm text-zinc-900">
      <thead className="bg-zinc-100 sticky top-0">
        <tr>
          {["종합", "합계", "공장", "영업", "연구소"].map((h) => (
            <th
              key={h}
              className="px-5 py-3 text-left font-bold text-zinc-800 border-b-2 border-zinc-300"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {summary.map((row, i) => {
          const isSummaryRow =
            row.종합.includes("합계") || row.종합 === "금융수수료";
          return (
            <tr
              key={row.종합}
              className={`border-b border-zinc-200 ${
                isSummaryRow ? "bg-blue-50 font-bold text-blue-900" : "hover:bg-zinc-50"
              } ${
                row.종합 === "금융료제외 합계" ? "border-t-2 border-t-zinc-400" : ""
              }`}
            >
              <td className="px-5 py-2.5">{row.종합}</td>
              <td className="px-5 py-2.5 text-right font-mono">
                {row.합계.toLocaleString()}
              </td>
              <td className="px-5 py-2.5 text-right font-mono">
                {row.공장.toLocaleString()}
              </td>
              <td className="px-5 py-2.5 text-right font-mono">
                {row.영업.toLocaleString()}
              </td>
              <td className="px-5 py-2.5 text-right font-mono">
                {row.연구소.toLocaleString()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
