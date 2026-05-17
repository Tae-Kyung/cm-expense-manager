"use client";

import { useState, useEffect, useCallback } from "react";

interface AggRow {
  key: string;
  입금: number;
  출금: number;
  건수: number;
}

interface AnalysisData {
  availableMonths: string[];
  uniqueValues: {
    계정: string[];
    계정과목: string[];
    제품명: string[];
    담당자: string[];
    구분: string[];
  };
  aggregations: {
    byMonth: AggRow[];
    by계정: AggRow[];
    by계정과목: AggRow[];
    by제품명: AggRow[];
    by담당자: AggRow[];
    by구분: AggRow[];
  };
  totals: {
    입금합계: number;
    출금합계: number;
    건수: number;
  };
}

type Dimension = "byMonth" | "by계정" | "by계정과목" | "by제품명" | "by담당자" | "by구분";

const DIMENSION_LABELS: Record<Dimension, string> = {
  byMonth: "기간별",
  "by계정": "계정별",
  "by계정과목": "계정과목별",
  "by제품명": "제품별",
  "by담당자": "담당자별",
  "by구분": "구분별",
};

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDimension, setActiveDimension] = useState<Dimension>("byMonth");

  // 필터 상태
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [filter계정, setFilter계정] = useState("");
  const [filter계정과목, setFilter계정과목] = useState("");
  const [filter제품명, setFilter제품명] = useState("");
  const [filter담당자, setFilter담당자] = useState("");
  const [filter구분, setFilter구분] = useState("");
  const [filterSections, setFilterSections] = useState<string[]>(["general", "finance"]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedMonths.length > 0) params.set("yearMonths", selectedMonths.join(","));
      if (filterSections.length > 0) params.set("sections", filterSections.join(","));
      if (filter계정) params.set("계정", filter계정);
      if (filter계정과목) params.set("계정과목", filter계정과목);
      if (filter제품명) params.set("제품명", filter제품명);
      if (filter담당자) params.set("담당자", filter담당자);
      if (filter구분) params.set("구분", filter구분);

      const res = await fetch(`/api/analysis?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "조회 실패");
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 오류");
    } finally {
      setLoading(false);
    }
  }, [selectedMonths, filterSections, filter계정, filter계정과목, filter제품명, filter담당자, filter구분]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  const toggleSection = (section: string) => {
    setFilterSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const clearFilters = () => {
    setSelectedMonths([]);
    setFilter계정("");
    setFilter계정과목("");
    setFilter제품명("");
    setFilter담당자("");
    setFilter구분("");
    setFilterSections(["general", "finance"]);
  };

  const activeData = data?.aggregations[activeDimension] || [];

  return (
    <div className="flex flex-col gap-6">
      {/* 필터 영역 */}
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-900">필터</h2>
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 rounded hover:bg-zinc-200"
          >
            필터 초기화
          </button>
        </div>

        {/* 기간 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-zinc-700 mb-2">기간 (미선택시 전체)</label>
          <div className="flex flex-wrap gap-2">
            {(data?.availableMonths || []).map((month) => (
              <button
                key={month}
                onClick={() => toggleMonth(month)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  selectedMonths.includes(month)
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {month}
              </button>
            ))}
          </div>
        </div>

        {/* 섹션 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-zinc-700 mb-2">데이터 유형</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "general", label: "일반경비" },
              { key: "finance", label: "금융수수료" },
              { key: "income", label: "영업외수익" },
              { key: "excluded", label: "경비제외" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleSection(key)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  filterSections.includes(key)
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 드롭다운 필터 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <FilterSelect
            label="계정"
            value={filter계정}
            onChange={setFilter계정}
            options={data?.uniqueValues.계정 || []}
          />
          <FilterSelect
            label="계정과목"
            value={filter계정과목}
            onChange={setFilter계정과목}
            options={data?.uniqueValues.계정과목 || []}
          />
          <FilterSelect
            label="제품명"
            value={filter제품명}
            onChange={setFilter제품명}
            options={data?.uniqueValues.제품명 || []}
          />
          <FilterSelect
            label="담당자"
            value={filter담당자}
            onChange={setFilter담당자}
            options={data?.uniqueValues.담당자 || []}
          />
          <FilterSelect
            label="구분"
            value={filter구분}
            onChange={setFilter구분}
            options={data?.uniqueValues.구분 || []}
          />
        </div>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* 총계 카드 */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="총 건수" value={`${data.totals.건수.toLocaleString()}건`} />
          <StatCard label="출금 합계" value={`${data.totals.출금합계.toLocaleString()}원`} color="red" />
          <StatCard label="입금 합계" value={`${data.totals.입금합계.toLocaleString()}원`} color="blue" />
        </div>
      )}

      {/* 분석 결과 */}
      {data && (
        <section className="bg-white rounded-lg border border-zinc-200 flex-1 flex flex-col overflow-hidden">
          {/* 차원 선택 탭 */}
          <div className="border-b border-zinc-200 px-4">
            <div className="flex gap-1 -mb-px pt-2">
              {(Object.entries(DIMENSION_LABELS) as [Dimension, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveDimension(key)}
                  className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                    activeDimension === key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 테이블 */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <p className="p-8 text-center text-zinc-400">로딩 중...</p>
            ) : activeData.length === 0 ? (
              <p className="p-8 text-center text-zinc-400">데이터가 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 sticky top-0">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold text-zinc-900 border-b-2 border-zinc-300">
                      {DIMENSION_LABELS[activeDimension]}
                    </th>
                    <th className="px-5 py-3 text-right font-bold text-zinc-900 border-b-2 border-zinc-300">건수</th>
                    <th className="px-5 py-3 text-right font-bold text-zinc-900 border-b-2 border-zinc-300">출금</th>
                    <th className="px-5 py-3 text-right font-bold text-zinc-900 border-b-2 border-zinc-300">입금</th>
                    <th className="px-5 py-3 text-right font-bold text-zinc-900 border-b-2 border-zinc-300">차액(출금-입금)</th>
                    <th className="px-5 py-3 text-left font-bold text-zinc-900 border-b-2 border-zinc-300 w-64">비율</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.map((row) => {
                    const maxOut = Math.max(...activeData.map((r) => r.출금), 1);
                    const pct = (row.출금 / maxOut) * 100;
                    return (
                      <tr key={row.key} className="hover:bg-blue-50 border-b border-zinc-200">
                        <td className="px-5 py-3 font-bold text-zinc-900 whitespace-nowrap">
                          {row.key}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-zinc-700">
                          {row.건수.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-red-700 font-bold">
                          {row.출금.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-blue-700">
                          {row.입금.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-zinc-800">
                          {(row.출금 - row.입금).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-4 bg-zinc-100 rounded overflow-hidden">
                              <div
                                className="h-full bg-red-400 rounded"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500 w-10 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-zinc-50 border-t-2 border-zinc-300">
                  <tr>
                    <td className="px-5 py-3 font-bold text-zinc-900">합계</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-zinc-900">
                      {activeData.reduce((s, r) => s + r.건수, 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-red-700">
                      {activeData.reduce((s, r) => s + r.출금, 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-blue-700">
                      {activeData.reduce((s, r) => s + r.입금, 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-zinc-900">
                      {activeData.reduce((s, r) => s + (r.출금 - r.입금), 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-zinc-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white text-zinc-800"
      >
        <option value="">전체</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClass =
    color === "red" ? "text-red-700" : color === "blue" ? "text-blue-700" : "text-zinc-900";
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`text-xl font-bold mt-1 font-mono ${colorClass}`}>{value}</p>
    </div>
  );
}
