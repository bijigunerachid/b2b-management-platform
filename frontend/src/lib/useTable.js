import { useMemo, useState } from "react";

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1;
  if (b === null || b === undefined || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function useTable(rows, { accessors = {}, initialSort, pageSize = 10 } = {}) {
  const [sort, setSort] = useState(initialSort ?? { key: null, direction: "asc" });
  const [requestedPage, setPage] = useState(1);

  const sorted = useMemo(() => {
    const getValue = accessors[sort.key];
    if (!getValue) return rows;

    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(getValue(a), getValue(b)));
    // `accessors` is a static object literal per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  return {
    rows: pageRows,
    sorted,
    sort,
    toggleSort,
    page,
    setPage,
    totalPages,
    total: sorted.length,
    pageSize,
  };
}
