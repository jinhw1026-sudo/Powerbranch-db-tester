import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Download, ChevronDown, ChevronRight, Trash2, Users, LayoutDashboard, ClipboardList, LogOut, Star } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase, configured } from "./supabaseClient";

const NAMES = ["양진환", "김윤교", "김주형", "이동호"];
const MONTHS = ["7월", "8월", "9월"];
const CALL_KEYS = ["call1", "call2", "call3", "call4", "call5", "call6"];
const CALL_LABELS = ["1차콜", "2차콜", "3차콜", "4차콜", "5차콜", "6차콜"];
const CALL_OPTS = ["", "받음", "안받음"];
const INTENT_OPTS = ["", "부재", "재통화요청", "거절", "상담요청", "비대면상담요청", "교환대상"];
const METHOD_OPTS = ["", "전화", "채팅"];
const YESNO_OPTS = ["", "예", "아니오"];

const METRICS = [
  { key: "total", label: "DB구매수", fmt: (v) => v },
  { key: "callRate", label: "콜받음전환율", fmt: (v) => pct(v) },
  { key: "seatRate", label: "싯플랜확정율", fmt: (v) => pct(v) },
  { key: "consultRate", label: "상담확정율", fmt: (v) => pct(v) },
  { key: "closingRate", label: "클로징확정율", fmt: (v) => pct(v) },
  { key: "premium", label: "월납보험료 합계", fmt: (v) => won(v) },
];

function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}
function won(v) {
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function formatDate(v) {
  if (!v) return "";
  const t = String(v).trim();
  return /^\d{1,2}$/.test(t) ? `${t}일` : t;
}
function emptyEntry(owner, month) {
  const e = { id: uid(), owner, purchaseMonth: month, purchaseDate: "", customerName: "", favorite: false, method: "전화", intent: "", seatplan: "", consult: "", closing: "", premium: "", note: "" };
  CALL_KEYS.forEach((k) => (e[k] = ""));
  return e;
}
function computeStats(list) {
  const total = list.length;
  const callOk = list.filter((e) => CALL_KEYS.some((k) => e[k] === "받음")).length;
  const seat = list.filter((e) => e.seatplan === "예").length;
  const consult = list.filter((e) => e.consult === "예").length;
  const closing = list.filter((e) => e.closing === "예").length;
  const premium = list.reduce((s, e) => s + (parseFloat(e.premium) || 0), 0);
  return {
    total,
    callRate: total ? callOk / total : 0,
    seatRate: total ? seat / total : 0,
    consultRate: total ? consult / total : 0,
    closingRate: total ? closing / total : 0,
    premium,
  };
}

// 상태 뱃지 (골드/네이비 톤)
function stageBadge(entry) {
  if (entry.closing === "예") return { text: "클로징확정", cls: "bg-[#c8a24a] text-[#23405f] border border-[#c8a24a]" };
  if (entry.consult === "예") return { text: "상담확정", cls: "border border-[#c8a24a] text-[#efe3c2]" };
  if (entry.seatplan === "예") return { text: "싯플랜확정", cls: "border border-[#c8a24a] text-[#efe3c2]" };
  return { text: "진행중", cls: "border border-[#6f8db4] text-[#d3e0f0]" };
}

// 접힌 카드에 보일 진행도 태그들
function progressTags(entry) {
  const tags = [];
  tags.push({ label: entry.method === "채팅" ? "채팅" : "전화", tone: entry.method === "채팅" ? "chat" : "method" });
  tags.push({ label: entry.seatplan === "예" ? "싯플랜 확정" : "싯플랜 대기", tone: entry.seatplan === "예" ? "on" : "wait" });
  tags.push({ label: entry.consult === "예" ? "상담 확정" : "상담 대기", tone: entry.consult === "예" ? "on" : "wait" });
  if (entry.closing === "예") tags.push({ label: "클로징 확정", tone: "on" });
  if (entry.intent) tags.push({ label: entry.intent, tone: "intent" });
  return tags;
}
const TAG_TONE = {
  method: "bg-[#eef2f7] text-[#42546b]",
  chat: "bg-[#eaf3ee] text-[#2f7d55]",
  on: "bg-[#faf4e2] text-[#96751f] ring-1 ring-inset ring-[#efe3c2]",
  wait: "bg-slate-100 text-slate-400",
  intent: "bg-[#eef3fb] text-[#2b6cb0]",
};

// Supabase row(snake_case) <-> 앱 내부 entry(camelCase) 변환
function fromRow(r) {
  return {
    id: r.id,
    owner: r.owner || "",
    purchaseMonth: r.purchase_month || "",
    purchaseDate: r.purchase_date || "",
    customerName: r.customer_name || "",
    favorite: !!r.favorite,
    method: r.method || "전화",
    call1: r.call1 || "",
    call2: r.call2 || "",
    call3: r.call3 || "",
    call4: r.call4 || "",
    call5: r.call5 || "",
    call6: r.call6 || "",
    intent: r.intent || "",
    seatplan: r.seatplan || "",
    consult: r.consult || "",
    closing: r.closing || "",
    premium: r.premium ?? "",
    note: r.note || "",
  };
}
function toRow(e) {
  return {
    id: e.id,
    owner: e.owner,
    purchase_month: e.purchaseMonth,
    purchase_date: e.purchaseDate,
    customer_name: e.customerName,
    favorite: !!e.favorite,
    method: e.method,
    call1: e.call1,
    call2: e.call2,
    call3: e.call3,
    call4: e.call4,
    call5: e.call5,
    call6: e.call6,
    intent: e.intent,
    seatplan: e.seatplan,
    consult: e.consult,
    closing: e.closing,
    premium: e.premium === "" ? 0 : parseFloat(e.premium) || 0,
    note: e.note,
  };
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";
const selectCls = inputCls + " appearance-none";

function EntryCard({ entry, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const callDone = CALL_KEYS.filter((k) => entry[k]).length;
  const badge = stageBadge(entry);
  const tags = progressTags(entry);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 bg-[#3f6ea3] px-3 py-2.5 text-white">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          {open ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-[#a9c0dd]" /> : <ChevronRight size={16} className="mt-0.5 shrink-0 text-[#a9c0dd]" />}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold">{entry.customerName || "(고객명 미입력)"}</span>
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[#b4c6dd]">
              {entry.purchaseMonth} · {formatDate(entry.purchaseDate) || "일자 미입력"}{entry.method === "채팅" ? " · 💬채팅" : ` · 콜 ${callDone}/6`}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onChange({ ...entry, favorite: !entry.favorite })}
            aria-label="즐겨찾기"
            className="p-0.5"
          >
            <Star size={18} className={entry.favorite ? "fill-[#f5b301] text-[#f5b301]" : "text-[#7d97ba]"} />
          </button>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {tags.map((t, i) => (
          <span key={i} className={`rounded-md px-2 py-1 text-[11px] font-medium ${TAG_TONE[t.tone]}`}>
            {t.label}
          </span>
        ))}
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="구매월">
              <div className="flex gap-1">
                {MONTHS.map((m) => (
                  <button
                    key={m}
                    onClick={() => onChange({ ...entry, purchaseMonth: m })}
                    className={`flex-1 rounded-lg border px-1.5 py-1.5 text-xs font-medium ${
                      entry.purchaseMonth === m ? "border-[#3f6ea3] bg-[#3f6ea3] text-white" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="구매일자">
              <input className={inputCls} placeholder="예: 10 (숫자만 입력하면 자동으로 10일)" value={entry.purchaseDate} onChange={(e) => onChange({ ...entry, purchaseDate: e.target.value })} />
            </Field>
          </div>

          <Field label="고객명">
            <input className={inputCls} placeholder="고객명 입력" value={entry.customerName} onChange={(e) => onChange({ ...entry, customerName: e.target.value })} />
          </Field>

          <Field label="진행방식">
            <div className="flex gap-1.5">
              {["전화", "채팅"].map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ ...entry, method: m })}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium ${
                    entry.method === m ? "border-[#3f6ea3] bg-[#3f6ea3] text-white" : "border-slate-200 text-slate-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          <div>
            <div className="mb-1 text-xs text-slate-500">통화 이력 {entry.method === "채팅" && <span className="text-slate-400">(채팅 건은 선택 안 해도 됩니다)</span>}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {CALL_KEYS.map((k, i) => (
                <select key={k} className={selectCls + " text-center"} value={entry[k]} onChange={(e) => onChange({ ...entry, [k]: e.target.value })}>
                  {CALL_OPTS.map((o) => (
                    <option key={o} value={o}>
                      {o === "" ? CALL_LABELS[i] : `${CALL_LABELS[i]}: ${o}`}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>

          <Field label="고객의사">
            <select className={selectCls} value={entry.intent} onChange={(e) => onChange({ ...entry, intent: e.target.value })}>
              {INTENT_OPTS.map((o) => (
                <option key={o} value={o}>
                  {o || "선택"}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            {[
              ["seatplan", "싯플랜확정"],
              ["consult", "상담확정"],
              ["closing", "클로징확정"],
            ].map(([k, label]) => (
              <Field key={k} label={label}>
                <select className={selectCls} value={entry[k]} onChange={(e) => onChange({ ...entry, [k]: e.target.value })}>
                  {YESNO_OPTS.map((o) => (
                    <option key={o} value={o}>
                      {o || "선택"}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>

          <Field label="월납보험료 (원)">
            <input className={inputCls} inputMode="numeric" placeholder="예: 240000" value={entry.premium} onChange={(e) => onChange({ ...entry, premium: e.target.value.replace(/[^0-9]/g, "") })} />
          </Field>

          <Field label="비고">
            <textarea
              className={inputCls + " min-h-[80px] resize-y leading-relaxed"}
              rows={3}
              placeholder="메모 (여러 줄 입력 가능)"
              value={entry.note}
              onChange={(e) => onChange({ ...entry, note: e.target.value })}
            />
          </Field>

          <button onClick={onDelete} className="flex items-center gap-1 text-xs font-medium text-rose-500">
            <Trash2 size={13} /> 이 항목 삭제
          </button>
        </div>
      )}
    </div>
  );
}

function StatGrid({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {METRICS.map((m) => (
        <div key={m.key} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[11px] text-slate-400">{m.label}</div>
          <div className="mt-1 text-lg font-bold text-slate-800">{m.fmt(stats[m.key])}</div>
        </div>
      ))}
    </div>
  );
}

function MonthTable({ entries }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 text-left font-medium">지표</th>
            {MONTHS.map((m) => (
              <th key={m} className="px-3 py-2 text-center font-medium">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m, i) => (
            <tr key={m.key} className={i % 2 ? "bg-slate-50" : "bg-white"}>
              <td className="px-3 py-2 text-slate-600">{m.label}</td>
              {MONTHS.map((mo) => {
                const stats = computeStats(entries.filter((e) => e.purchaseMonth === mo));
                return (
                  <td key={mo} className="px-3 py-2 text-center font-semibold text-slate-800">
                    {m.fmt(stats[m.key])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 관리자 열람용 읽기전용 카드 (수정 불가, 펼치면 상세 표시)
function ReadonlyCard({ entry }) {
  const [open, setOpen] = useState(false);
  const callDone = CALL_KEYS.filter((k) => entry[k]).length;
  const badge = stageBadge(entry);
  const tags = progressTags(entry);

  const row = (label, value) => (
    <div className="flex justify-between gap-2 py-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value || "-"}</span>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-2 bg-[#3f6ea3] px-3 py-2.5 text-left text-white">
        <div className="flex min-w-0 items-start gap-2">
          {open ? <ChevronDown size={16} className="mt-0.5 shrink-0 text-[#a9c0dd]" /> : <ChevronRight size={16} className="mt-0.5 shrink-0 text-[#a9c0dd]" />}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold">{entry.customerName || "(고객명 미입력)"}</span>
              {entry.favorite && <Star size={14} className="shrink-0 fill-[#f5b301] text-[#f5b301]" />}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[#b4c6dd]">
              {entry.purchaseMonth} · {formatDate(entry.purchaseDate) || "일자 미입력"}{entry.method === "채팅" ? " · 💬채팅" : ` · 콜 ${callDone}/6`}
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span>
      </button>
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {tags.map((t, i) => (
          <span key={i} className={`rounded-md px-2 py-1 text-[11px] font-medium ${TAG_TONE[t.tone]}`}>
            {t.label}
          </span>
        ))}
      </div>
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          {row("구매월", entry.purchaseMonth)}
          {row("구매일자", formatDate(entry.purchaseDate))}
          {row("고객명", entry.customerName)}
          {row("진행방식", entry.method)}
          <div className="py-1 text-xs">
            <div className="mb-1 text-slate-400">통화 이력</div>
            <div className="grid grid-cols-3 gap-1">
              {CALL_KEYS.map((k, i) => (
                <div key={k} className="rounded bg-slate-50 px-1.5 py-1 text-center text-slate-600">
                  {CALL_LABELS[i]}: {entry[k] || "-"}
                </div>
              ))}
            </div>
          </div>
          {row("고객의사", entry.intent)}
          {row("싯플랜확정", entry.seatplan)}
          {row("상담확정", entry.consult)}
          {row("클로징확정", entry.closing)}
          {row("월납보험료", entry.premium ? `${Number(entry.premium).toLocaleString("ko-KR")}원` : "")}
          <div className="py-1 text-xs">
            <div className="mb-1 text-slate-400">비고</div>
            <div className="whitespace-pre-wrap break-words rounded bg-slate-50 px-2 py-1.5 text-slate-700">{entry.note || "-"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// 관리자 대시보드 하단: 인원별 상세 목록 뷰어
function AdminDetailViewer({ entries }) {
  const [who, setWho] = useState(NAMES[0]);
  const [mon, setMon] = useState("전체");
  const list = entries
    .filter((e) => e.owner === who)
    .filter((e) => (mon === "전체" ? true : e.purchaseMonth === mon));

  return (
    <section>
      <div className="mb-2 text-sm font-semibold text-slate-700">인원별 상세 목록 (개별 입력 내용 보기)</div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {NAMES.map((n) => (
          <button key={n} onClick={() => setWho(n)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${who === n ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>
            {n}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {["전체", ...MONTHS].map((m) => (
          <button key={m} onClick={() => setMon(m)} className={`rounded-full px-2.5 py-1 text-xs ${mon === m ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.length === 0 && <div className="py-6 text-center text-sm text-slate-400">{who}님이 입력한 {mon !== "전체" ? mon + " " : ""}내역이 없습니다</div>}
        {list.map((e) => (
          <ReadonlyCard key={e.id} entry={e} />
        ))}
      </div>
    </section>
  );
}

function PersonRow({ name, entries }) {
  const [open, setOpen] = useState(false);
  const stats = computeStats(entries);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((o) => !o)} className="grid w-full grid-cols-6 items-center gap-1 px-3 py-2.5 text-left sm:gap-2">
        <div className="col-span-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {name}
        </div>
        {METRICS.slice(0, 5).map((m) => (
          <div key={m.key} className="text-center text-xs text-slate-600 sm:text-sm">
            {m.fmt(stats[m.key])}
          </div>
        ))}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <div className="mb-2 text-xs text-slate-400">{name} 월별 현황</div>
          <MonthTable entries={entries} />
        </div>
      )}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <div className="font-semibold">Supabase 연결이 안 되어 있어요</div>
      <p className="mt-1">
        .env 파일에 <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code>과{" "}
        <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>를 넣고 다시 빌드/배포해주세요. (README.md 참고)
      </p>
    </div>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [entries, setEntries] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem("pb_last_user") || null);
  const [tab, setTab] = useState("entry");
  const [monthFilter, setMonthFilter] = useState("7월");
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [favOnly, setFavOnly] = useState(false);

  // 내가 방금 편집 중인 항목: 실시간 에코가 이 항목을 덮어쓰지 않도록 잠깐 보호
  const editingRef = useRef({}); // { [id]: 마지막_편집시각(ms) }
  const saveTimers = useRef({}); // { [id]: setTimeout 핸들 }
  const EDIT_GUARD_MS = 2500;

  useEffect(() => {
    if (!configured) {
      setLoaded(true);
      return;
    }
    let channel;
    (async () => {
      const { data, error } = await supabase.from("entries").select("*").order("created_at", { ascending: false });
      if (!error && data) setEntries(data.map(fromRow));
      setLoaded(true);

      channel = supabase
        .channel("entries-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, (payload) => {
          setEntries((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((e) => e.id !== payload.old.id);
            }
            const next = fromRow(payload.new);
            // 내가 지금 편집 중인 항목이면 서버 값으로 덮어쓰지 않음 (글자 튐 방지)
            const lastEdit = editingRef.current[next.id];
            if (lastEdit && Date.now() - lastEdit < EDIT_GUARD_MS) {
              return prev;
            }
            const exists = prev.some((e) => e.id === next.id);
            return exists ? prev.map((e) => (e.id === next.id ? next : e)) : [next, ...prev];
          });
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
      Object.values(saveTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  function selectUser(name) {
    setCurrentUser(name);
    localStorage.setItem("pb_last_user", name);
  }

  async function addEntry() {
    const e = emptyEntry(currentUser, monthFilter);
    setEntries((prev) => [e, ...prev]);
    await supabase.from("entries").insert(toRow(e));
  }

  // 타이핑 중엔 화면(state)만 즉시 갱신하고, 서버 저장은 0.6초 멈춘 뒤 한 번만 실행
  function updateEntry(id, next) {
    editingRef.current[id] = Date.now();
    setEntries((prev) => prev.map((e) => (e.id === id ? next : e)));
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      editingRef.current[id] = Date.now();
      await supabase.from("entries").update(toRow(next)).eq("id", id);
      setTimeout(() => {
        delete editingRef.current[id];
      }, 800);
    }, 600);
  }
  async function deleteEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("entries").delete().eq("id", id);
  }

  const myEntries = useMemo(() => (showAllOwners ? entries : entries.filter((e) => e.owner === currentUser)), [entries, showAllOwners, currentUser]);
  const monthEntries = useMemo(
    () => myEntries.filter((e) => (favOnly ? e.favorite : e.purchaseMonth === monthFilter)),
    [myEntries, monthFilter, favOnly]
  );

  const [dashFilter, setDashFilter] = useState("전체");
  const dashEntries = useMemo(() => (dashFilter === "전체" ? entries : entries.filter((e) => e.owner === dashFilter)), [entries, dashFilter]);
  const cumStats = useMemo(() => computeStats(dashEntries), [dashEntries]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const summary = [["전체 누적 현황", ""]];
    METRICS.forEach((m) => summary.push([m.label, m.fmt(cumStats[m.key])]));
    summary.push([]);
    summary.push(["전체 월별 현황", ...MONTHS]);
    METRICS.forEach((m) => {
      const row = [m.label];
      MONTHS.forEach((mo) => row.push(m.fmt(computeStats(entries.filter((e) => e.purchaseMonth === mo))[m.key])));
      summary.push(row);
    });
    summary.push([]);
    summary.push(["인원별 누적 비교", ...METRICS.map((m) => m.label)]);
    NAMES.forEach((n) => {
      const s = computeStats(entries.filter((e) => e.owner === n));
      summary.push([n, ...METRICS.map((m) => m.fmt(s[m.key]))]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "전체현황");

    const dataHeader = ["즐겨찾기", "구매월", "구매일자", "고객명", "진행방식", ...CALL_LABELS, "고객의사", "싯플랜확정", "상담확정", "클로징확정", "월납보험료", "비고"];
    NAMES.forEach((n) => {
      const list = entries.filter((e) => e.owner === n);
      const s = computeStats(list);
      const rows = [[`${n} 누적 요약`, ""]];
      METRICS.forEach((m) => rows.push([m.label, m.fmt(s[m.key])]));
      rows.push([]);
      rows.push(["월별 요약", ...MONTHS]);
      METRICS.forEach((m) => {
        const row = [m.label];
        MONTHS.forEach((mo) => row.push(m.fmt(computeStats(list.filter((e) => e.purchaseMonth === mo))[m.key])));
        rows.push(row);
      });
      rows.push([]);
      rows.push(dataHeader);
      list.forEach((e) => rows.push([e.favorite ? "★" : "", e.purchaseMonth, formatDate(e.purchaseDate), e.customerName, e.method, ...CALL_KEYS.map((k) => e[k]), e.intent, e.seatplan, e.consult, e.closing, e.premium, e.note]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), n);
    });

    XLSX.writeFile(wb, `파워지점_DB_테스터_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (!configured) return <SetupNotice />;

  if (!loaded) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-400">불러오는 중...</div>;
  }

  if (!currentUser) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-sm flex-col items-center justify-center gap-6 px-6 py-16">
        <div className="text-center">
          <div className="text-xl font-bold text-slate-800">파워지점 DB 테스터</div>
          <div className="mt-1 text-sm text-slate-400">누구세요? 이름을 선택하면 바로 시작합니다</div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3">
          {NAMES.map((n) => (
            <button key={n} onClick={() => selectUser(n)} className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 shadow-sm active:bg-slate-50">
              {n}
            </button>
          ))}
        </div>
        <button onClick={() => selectUser("관리자")} className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Users size={14} /> 관리자로 대시보드만 보기
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-base font-bold text-slate-800">파워지점 DB 테스터</div>
          <div className="text-xs text-slate-400">{currentUser}님으로 접속중</div>
        </div>
        <button onClick={() => setCurrentUser(null)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500">
          <LogOut size={13} /> 전환
        </button>
      </div>

      <div className="mb-4 flex rounded-xl bg-slate-100 p-1 text-sm">
        <button onClick={() => setTab("entry")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium ${tab === "entry" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
          <ClipboardList size={15} /> 입력
        </button>
        <button onClick={() => setTab("dashboard")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium ${tab === "dashboard" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
          <LayoutDashboard size={15} /> 대시보드
        </button>
      </div>

      {tab === "entry" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {MONTHS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMonthFilter(m);
                  setFavOnly(false);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${!favOnly && monthFilter === m ? "bg-[#3f6ea3] text-white" : "bg-slate-100 text-slate-500"}`}
              >
                {m}
              </button>
            ))}
            <button
              onClick={() => setFavOnly((v) => !v)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                favOnly ? "bg-[#f5b301] text-white" : "bg-[#fff7e0] text-[#b4820a] ring-1 ring-inset ring-[#f4e2ad]"
              }`}
            >
              <Star size={13} className={favOnly ? "fill-white text-white" : "fill-[#f5b301] text-[#f5b301]"} /> 즐겨찾기
            </button>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" checked={showAllOwners} onChange={(e) => setShowAllOwners(e.target.checked)} />
              전체보기
            </label>
          </div>

          {!favOnly && (
            <button onClick={addEntry} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 active:bg-slate-50">
              <Plus size={16} /> {monthFilter} 신규 DB 추가
            </button>
          )}

          <div className="space-y-2">
            {monthEntries.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">
                {favOnly ? "즐겨찾기한 고객이 없습니다 (카드의 ★를 눌러 추가하세요)" : `${monthFilter}에 등록된 DB가 없습니다`}
              </div>
            )}
            {monthEntries.map((e) => (
              <EntryCard key={e.id} entry={e} onChange={(next) => updateEntry(e.id, next)} onDelete={() => deleteEntry(e.id)} />
            ))}
          </div>
        </div>
      )}

      {tab === "dashboard" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {["전체", ...NAMES].map((n) => (
              <button key={n} onClick={() => setDashFilter(n)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${dashFilter === n ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>
                {n}
              </button>
            ))}
            <button onClick={exportExcel} className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-emerald-700">
              <Download size={14} /> 엑셀 다운로드
            </button>
          </div>

          <section>
            <div className="mb-2 text-sm font-semibold text-slate-700">누적 전체 현황 {dashFilter !== "전체" && `· ${dashFilter}`}</div>
            <StatGrid stats={cumStats} />
          </section>

          <section>
            <div className="mb-2 text-sm font-semibold text-slate-700">월별 현황 {dashFilter !== "전체" && `· ${dashFilter}`}</div>
            <MonthTable entries={dashEntries} />
          </section>

          {dashFilter === "전체" && (
            <section>
              <div className="mb-2 text-sm font-semibold text-slate-700">인원별 현황 (탭하면 월별 상세)</div>
              <div className="grid grid-cols-6 gap-1 px-3 text-[11px] text-slate-400 sm:gap-2">
                <div className="col-span-1">이름</div>
                {METRICS.slice(0, 5).map((m) => (
                  <div key={m.key} className="text-center">
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {NAMES.map((n) => (
                  <PersonRow key={n} name={n} entries={entries.filter((e) => e.owner === n)} />
                ))}
              </div>
            </section>
          )}

          {currentUser === "관리자" && <AdminDetailViewer entries={entries} />}
        </div>
      )}
    </div>
  );
}
