"use client";

import { useState, useCallback, useEffect } from "react";
import type { TransformResult, Transaction, SummaryRow } from "@/lib/types";

type ViewTab = "general" | "finance" | "income" | "excluded" | "summary";
type Page = "upload" | "history" | "detail";

interface Upload {
  id: string;
  year_month: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  status: string;
  general_count: number;
  finance_count: number;
  income_count: number;
  excluded_count: number;
  general_total: number;
  finance_total: number;
  income_total: number;
}

interface ProcessResponse {
  result: TransformResult;
  excluded: Transaction[];
  uploadId?: string;
}

export default function Home() {
  const [page, setPage] = useState<Page>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransformResult | null>(null);
  const [excluded, setExcluded] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>("general");
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);

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

  // 변환만 실행 (미리보기)
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

  // DB에 저장
  const handleSave = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/save", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "저장 중 오류가 발생했습니다.");
      }

      const data: ProcessResponse = await res.json();
      setResult(data.result);
      setExcluded(data.excluded);
      setActiveTab("general");
      alert("데이터베이스에 저장되었습니다.");
      fetchHistory();
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

  // 이력 조회
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setUploads(data.uploads || []);
      }
    } catch {
      // silent fail
    }
  };

  // 이력 상세 조회
  const handleViewDetail = async (id: string) => {
    setLoading(true);
    setError(null);
    setSelectedUploadId(id);

    try {
      const res = await fetch(`/api/history/${id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "조회 실패");
      }

      const data = await res.json();
      setResult(data.result);
      setExcluded(data.excluded || []);
      setActiveTab("general");
      setPage("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 오류");
    } finally {
      setLoading(false);
    }
  };

  // 이력 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchHistory();
      }
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    if (page === "history") {
      fetchHistory();
    }
  }, [page]);

  return (
    <div className="flex-1 flex flex-col">
      {/* 네비게이션 탭 */}
      <nav className="bg-white border-b border-zinc-200 px-6">
        <div className="flex gap-1">
          {(
            [
              ["upload", "파일 업로드"],
              ["history", "월별 이력"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setPage(key); setResult(null); setError(null); }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                page === key || (page === "detail" && key === "history")
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 flex flex-col p-6 gap-6">
        {/* 업로드 페이지 */}
        {page === "upload" && (
          <>
            <section className="bg-white rounded-lg border border-zinc-200 p-6">
              <h2 className="text-base font-semibold text-zinc-700 mb-4">
                파일 업로드
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
                  {loading ? "처리 중..." : "미리보기"}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!file || loading}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? "저장 중..." : "DB 저장"}
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

            {result && <ResultSection result={result} excluded={excluded} activeTab={activeTab} setActiveTab={setActiveTab} />}
          </>
        )}

        {/* 이력 페이지 */}
        {page === "history" && (
          <section className="bg-white rounded-lg border border-zinc-200 p-6">
            <h2 className="text-lg font-bold text-zinc-900 mb-5">
              월별 처리 이력
            </h2>
            {uploads.length === 0 ? (
              <p className="text-zinc-500 text-base">저장된 이력이 없습니다.</p>
            ) : (
              <table className="w-full text-base">
                <thead className="bg-zinc-100">
                  <tr>
                    {["년월", "파일명", "업로드일", "일반경비", "금융수수료", "영업외수익", "상태", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-bold text-zinc-900 border-b-2 border-zinc-300 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id} className="hover:bg-blue-50 border-b border-zinc-200">
                      <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap">{u.year_month}</td>
                      <td className="px-4 py-3 text-zinc-800">{u.file_name}</td>
                      <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">
                        {new Date(u.uploaded_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-800">
                        <span className="font-bold">{u.general_count}</span>건 / {(u.general_total || 0).toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-800">
                        <span className="font-bold">{u.finance_count}</span>건 / {(u.finance_total || 0).toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-800">
                        <span className="font-bold">{u.income_count}</span>건 / {(u.income_total || 0).toLocaleString()}원
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded text-sm font-medium ${
                          u.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {u.status === "completed" ? "완료" : u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDetail(u.id)}
                            className="px-4 py-1.5 bg-blue-100 text-blue-700 text-sm font-bold rounded hover:bg-blue-200"
                          >
                            상세
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="px-4 py-1.5 bg-red-100 text-red-700 text-sm font-bold rounded hover:bg-red-200"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* 상세 페이지 */}
        {page === "detail" && result && (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setPage("history"); setResult(null); }}
                className="px-3 py-1.5 bg-zinc-100 text-zinc-600 text-sm rounded-md hover:bg-zinc-200"
              >
                &larr; 목록으로
              </button>
              <h2 className="text-base font-semibold text-zinc-700">
                {result.sheetName} 상세
              </h2>
              <button
                onClick={handleDownload}
                disabled={loading}
                className="px-4 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-40"
              >
                Excel 다운로드
              </button>
            </div>
            <ResultSection result={result} excluded={excluded} activeTab={activeTab} setActiveTab={setActiveTab} />
          </>
        )}
      </div>
    </div>
  );
}

function ResultSection({
  result,
  excluded,
  activeTab,
  setActiveTab,
}: {
  result: TransformResult;
  excluded: Transaction[];
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
}) {
  return (
    <section className="bg-white rounded-lg border border-zinc-200 flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-zinc-200 px-4">
        <h2 className="text-base font-semibold text-zinc-700 py-3">
          변환 결과 &mdash; {result.sheetName}
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
          />
        )}
      </div>

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
  );
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
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
            "관리번호", "발행일", "계정", "코드", "계정과목",
            "제품명", "세부내용", "입금", "출금", "담당자", "구분", "비고",
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
        {summary.map((row) => {
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
