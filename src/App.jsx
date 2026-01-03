import React, { useEffect, useMemo, useRef, useState } from "react";
import {analyzeHand,followupQuestion,saveHistory,fetchPlan,createCheckoutSession,createPortalSession,cancelPlan,updateHistoryConversation,} from "./api.js";
import CardPickerModal from "./components/CardPickerModal.jsx";
import BoardPickerModal from "./components/BoardPickerModal.jsx";
import ResultModal from "./components/ResultModal.jsx";  
import * as E from "./lib/engine.js";
// バックエンドのベースURL（.env の VITE_API_BASE）
const API_BASE = import.meta.env.VITE_API_BASE || "";

function SettingsModal({ open, onClose, userInfo, plan, remainingMonth, defaultStack, setDefaultStack, onLogout }) {
  // 追加：このモーダル内で使うリンク先（public/ にある想定）
  const PRIVACY_URL = "privacy.html";
  const TERMS_URL = "terms.html";
  const SUPPORT_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdCmr7yabVudrcoQ6VtIBnTua3r8GffCvTZgSArG4bMbNCQ_w/viewform?usp=dialog"; 
  const [activeTab, setActiveTab] = useState("account");

  const resolveUserId = () => {
    if (userInfo?.user_id) return userInfo.user_id;
    try {
      const u = JSON.parse(localStorage.getItem("pa_user") || "null");
      return u?.user_id || null;
    } catch {
      return null;
    }
  };

  const handleOpenPortal = async () => {
    const user_id = resolveUserId();
    if (!user_id) {
      alert("ユーザー情報が見つかりません。再ログインしてください。");
      return;
    }
    try {
      const resp = await createPortalSession({ user_id });
      if (resp?.ok && resp?.url) {
        window.location.href = resp.url;
      } else {
        alert("管理画面のURLを取得できませんでした。");
      }
    } catch (e) {
      console.error(e);
      alert(`管理画面を開けませんでした: ${String(e?.message || e)}`);
    }
  };

  const handleCancelSubscription = async () => {
    const user_id = resolveUserId();
    if (!user_id) {
      alert("ユーザー情報が見つかりません。再ログインしてください。");
      return;
    }
    const ok = window.confirm("定期購入を解約します。次回更新日までは利用できます。よろしいですか？");
    if (!ok) return;

    try {
      const resp = await cancelPlan({ user_id });
      const cancelAt = resp?.cancel_at ? new Date(resp.cancel_at).toLocaleString() : null;
      alert(cancelAt ? `解約を受け付けました。利用期限: ${cancelAt}` : "解約を受け付けました。");
      // 反映待ちでも、今の表示を更新しておく
      onClose?.();
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert(`解約に失敗しました: ${String(e?.message || e)}`);
    }
  };

  if (!open) return null;
  return (

    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 820,
          maxWidth: "96vw",
          height: 520,
          background: "linear-gradient(180deg,#0b1621,#020617)",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,.55)",
          color: "#e5e7eb",
          display: "flex",
        }}
        onClick={(e) => e.stopPropagation()}
      >
{/* 左ナビ */}
<aside style={{ width: 220, padding: 16, borderRight: "1px solid rgba(148,163,184,0.18)" }}>
  <div style={{ fontSize: 11, color: "rgba(203,213,225,0.7)", margin: "6px 8px 8px" }}>
    アカウント
  </div>
  {[
    ["account", "アカウント"],
    ["plan", "プラン"],
  ].map(([id, label]) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        width: "100%",
        padding: "10px 12px",
        textAlign: "left",
        borderRadius: 10,
        border: "1px solid transparent",
        background: activeTab === id ? "rgba(99,102,241,.15)" : "transparent",
        color: "#e5e7eb",
        marginBottom: 6,
      }}
    >
      {label}
    </button>
  ))}

  <div style={{ height: 12 }} />

  <div style={{ fontSize: 11, color: "rgba(203,213,225,0.7)", margin: "6px 8px 8px" }}>
    プレイ設定
  </div>
  {[
    ["input", "入力設定"],
    ["analysis", "解析設定"],
  ].map(([id, label]) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        width: "100%",
        padding: "10px 12px",
        textAlign: "left",
        borderRadius: 10,
        border: "1px solid transparent",
        background: activeTab === id ? "rgba(99,102,241,.15)" : "transparent",
        color: "#e5e7eb",
        marginBottom: 6,
      }}
    >
      {label}
    </button>
  ))}

  <div style={{ height: 12 }} />

  <div style={{ fontSize: 11, color: "rgba(203,213,225,0.7)", margin: "6px 8px 8px" }}>
    サポート
  </div>
  {[
    ["support", "サポート"],
    ["data", "データ管理"],
  ].map(([id, label]) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        width: "100%",
        padding: "10px 12px",
        textAlign: "left",
        borderRadius: 10,
        border: "1px solid transparent",
        background: activeTab === id ? "rgba(99,102,241,.15)" : "transparent",
        color: id === "data" ? "#fca5a5" : "#e5e7eb",
        marginBottom: 6,
      }}
    >
      {label}
    </button>
  ))}
</aside>

{/* 右ペイン */}
<main style={{ flex: 1, padding: 16, overflow: "auto" }}>
{activeTab === "account" && (
  <>
    <h3 style={{ marginTop: 0 }}>アカウント</h3>
    <div style={{ color: "#cbd5e1", lineHeight: 1.9 }}>
      <div>メール：{userInfo?.email || "-"}</div>
      <div>プラン：{plan ? plan.toUpperCase() : "-"}</div>
      <div>今月の残り解析：{remainingMonth === null ? "∞" : `${remainingMonth} 回`}</div>
    </div>

    {typeof onLogout === "function" && (
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={onLogout}
          style={{
            width: "fit-content",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(2,6,23,0.4)",
            color: "#e5e7eb",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ログアウト
        </button>
      </div>
    )}
  </>
)}

{activeTab === "input" && (
  <>
    <h3 style={{ marginTop: 0 }}>入力設定</h3>
    <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
      新規ハンド作成時の初期スタック（BB）に反映されます。
    </div>
    <input
      type="number"
      value={defaultStack}
      onChange={(e) => setDefaultStack(Number(e.target.value))}
      min={1}
    />
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
      全座席のデフォルトスタックを調整できます。個別に変更したい場合は、座席をクリックすることでスタックを変更できます。
    </div>
  </>
)}

{activeTab === "analysis" && (
  <>
    <h3 style={{ marginTop: 0 }}>解析設定</h3>
    <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>
      現在はキャッシュゲーム専用です。解析ロジック自体は固定で、表示スタイルのみ今後調整できるようにします。
    </div>

    <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(2,6,23,0.35)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>説明の詳しさ</div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>
        （準備中）短い / 標準 / 詳しい を選べるようにする予定です。
      </div>
    </div>
  </>
)}

{activeTab === "plan" && (
  <>
    <h3 style={{ marginTop: 0 }}>プラン</h3>
    <div style={{ color: "#cbd5e1", lineHeight: 1.9 }}>
      <div>現在：{plan ? plan.toUpperCase() : "-"}</div>
      <div>今月の残り解析：{remainingMonth === null ? "∞" : `${remainingMonth} 回`}</div>
    </div>

    <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
      プラン変更は右上の「プラン変更」から行えます。
    </div>

    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        onClick={handleOpenPortal}
        style={{
          width: "fit-content",
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(2,6,23,0.28)",
          color: "#cbd5e1",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        プラン管理（変更・カード・領収書）
      </button>

      <button
        type="button"
        onClick={handleCancelSubscription}
        style={{
          width: "fit-content",
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,0.18)",
          background: "transparent",
          color: "rgba(203,213,225,0.65)",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        定期購入を解約
      </button>
    </div>

    {typeof onLogout === "function" && (
      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={onLogout}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,80,80,0.12)",
            color: "#ffd1d1",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ログアウト
        </button>
      </div>
    )}
  </>
)}

{activeTab === "support" && (
  <>
    <h3 style={{ marginTop: 0 }}>サポート</h3>
    <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9 }}>
      ご意見・不具合報告はお問い合わせからお願いします。
    </div>

    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <a
        href={SUPPORT_FORM_URL}
        target="_blank"
        rel="noreferrer"
        style={{ color: "#93c5fd", textDecoration: "none" }}
      >
        お問い合わせ（Googleフォーム）
      </a>

      <div style={{ fontSize: 12, color: "#9ca3af" }}>
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#93c5fd", textDecoration: "none" }}
        >
          プライバシーポリシー
        </a>
        <span style={{ color: "#9ca3af" }}> / </span>
        <a
          href={TERMS_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: "#93c5fd", textDecoration: "none" }}
        >
          利用規約
        </a>
      </div>
    </div>
  </>
)}

{activeTab === "data" && (
  <>
    <h3 style={{ marginTop: 0, color: "#fecaca" }}>データ管理</h3>
    <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.8 }}>
      データ削除は元に戻せません。
    </div>

    {/* ここは “本当に削除する機能” になるので、まずは無効化を推奨 */}
    <button className="btn btn-danger" disabled style={{ marginTop: 12, opacity: 0.6, cursor: "not-allowed" }}>
      履歴をすべて削除（準備中）
    </button>
  </>
)}
</main>

      </div>
    </div>
  );
}

/* ====== layout utils ====== */
function useSize(){
  const ref = useRef(null);
  const [s, setS] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const update = () => {
      // padding を含む表示実寸で取得（絶対配置の基準と一致させる）
      setS({ w: el.clientWidth, h: el.clientHeight });
    };

    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();

    return () => ro.disconnect();
  }, []);

  return [ref, s];
}

/* ====== pretty cards ====== */
const suitSym = { s:"♠", h:"♥", d:"♦", c:"♣" };
const pretty = (c, cls="")=>{
  if(!c) return null;
  const r=c[0], s=c[1];
  const red = s==="h" || s==="d" ? "s-red" : "s-black";
  return <span className={`cardStr ${cls} ${red}`}>{r}{suitSym[s]}</span>;
};

// BB表示を 3.00→3 / 6.50→6.5 に丸める
function fmtBB(n){
  const x = Number(n ?? 0);
  const s = x.toFixed(2).replace(/\.00$/,"").replace(/(\.\d)0$/,"$1");
  return `${s}BB`;
}

// === boardで使う同柄表示（ピッカーと同等配色） ===
const SUIT_SYM_BOARD = { h: "♥", d: "♦", s: "♠", c: "♣" };
function PrettyBoardCard({ card }) {
  if (!card || String(card).length < 2) return null;
  const r = String(card)[0].toUpperCase();
  const s = String(card)[1].toLowerCase();
  const color = s === "h" || s === "d" ? "#ff6b81" : "#9ecbff";
  return (
    <span style={{ fontWeight: 800 }}>
      {r}
      <span style={{ marginLeft: 6, color }}>{SUIT_SYM_BOARD[s] || ""}</span>
    </span>
  );
}


/* ====== log text ====== */
const fmt = a => {
  const t = (a.type||"").toUpperCase();
  if (t==="FOLD"||t==="CHECK") return `${a.actor} ${t}`;
  if (t==="CALL")  return `${a.actor} Call ${fmtBB(a.put)}`;
  if (t==="BET")   return `${a.actor} Bet ${fmtBB(a.put)}`;
  if (t==="RAISE") return `${a.actor} Raise ${fmtBB(a.to)}`;
  return `${a.actor} ${a.type}`;
};

const line = (actions, st) => actions[st].map(fmt).join(" ");

/* ====== history (local) ====== */
const HKEY = "poker_history";
const loadHist = () => {
  try { return JSON.parse(localStorage.getItem(HKEY) || "[]"); }
  catch { return []; }
};
const saveHist = (rows) => localStorage.setItem(HKEY, JSON.stringify(rows));
const uid = () => Math.random().toString(36).slice(2,10);


// Sが未生成でも座席を描画するためのデフォルト座席
const FALLBACK_SEATS = ["UTG","UTG+1","LJ","HJ","CO","BTN","SB","BB","Seat9","Seat10"];
const buildSeatsList = (S, players) =>
  (S?.seats ?? FALLBACK_SEATS).slice(0, Math.max(2, players));


/* ====== main ====== */
export default function App(){

  // ログアウト（localStorage をクリアしてログインへ）
  const handleLogout = () => {
    try {
      localStorage.removeItem("pa_user");
    } finally {
      window.location.href = "login.html";
    }
  };

  // プラン変更モーダル用
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForCheckout, setPlanForCheckout] = useState("basic");

// 認証状態（B案：未ログインでも画面に入れる）
const [auth, setAuth] = useState({ loggedIn: false, user: null });

// ユーザー情報（メール表示用）
const [userInfo, setUserInfo] = useState(null);

// 設定モーダル
const [showSettings, setShowSettings] = useState(false);

// default_stack（DB同期）
const [defaultStack, setDefaultStack] = useState(100);

// ★ 最後にDBへ保存できた default_stack を保持（無駄な再保存防止）
const lastSavedDefaultStackRef = useRef(null);

useEffect(() => {
  try {
    const u = JSON.parse(localStorage.getItem("pa_user") || "null");
    if (u && u.user_id) {
      setAuth({ loggedIn: true, user: u });
    } else {
      setAuth({ loggedIn: false, user: null });
    }
  } catch {
    setAuth({ loggedIn: false, user: null });
  }
}, []);

// auth から userInfo をセット（未ログインは null）
useEffect(() => {
  if (auth.loggedIn && auth.user?.email) {
    setUserInfo({ email: auth.user.email });
  } else {
    setUserInfo(null);
  }
}, [auth.loggedIn, auth.user]);

// ==== default_stack を DB から取得 ====
useEffect(() => {
  if (!auth.loggedIn || !auth.user?.user_id) return;

  (async () => {
    try {
      const res = await fetch(
        `${API_BASE}/settings/user_info?user_id=${encodeURIComponent(auth.user.user_id)}`
      );
      if (!res.ok) return;

      const data = await res.json();

if (data?.ok && data?.default_stack != null) {
  const v = Number(data.default_stack);
  setDefaultStack(v);
  lastSavedDefaultStackRef.current = v;

  // heroStack が未設定なら初期表示も合わせる
  setHeroStack((prev) => (prev == null ? v : prev));
}
    } catch {
      // 取得失敗時は何もしない（デフォルト値を維持）
    }
  })();
}, [auth.loggedIn, auth.user?.user_id]);

// ==== default_stack を DB に保存（②：ここに追加するのが適正）====
useEffect(() => {
  if (!auth.loggedIn || !auth.user?.user_id) return;

  // 読み込み直後や同一値は保存しない
  if (lastSavedDefaultStackRef.current === defaultStack) return;

  const t = setTimeout(async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/update_default_stack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: auth.user.user_id,
          default_stack: Number(defaultStack),
        }),
      });
      if (!res.ok) return;

      const data = await res.json();
      if (data?.ok && data?.default_stack != null) {
        lastSavedDefaultStackRef.current = Number(data.default_stack);
      }
    } catch {
      // 失敗時は何もしない（必要ならトースト表示に変更可）
    }
  }, 500);

  return () => clearTimeout(t);
}, [defaultStack, auth.loggedIn, auth.user?.user_id]);

  // プラン情報の取得
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("pa_user") || "null");
    if (!u || !u.user_id) return;

    (async () => {
      try {
        const res = await fetchPlan(u.user_id);
        if (res && res.ok) {
          const p = res.plan || "free";
          setPlan(p);
          // 現在プランをモーダルの初期選択にも反映
          if (p === "basic" || p === "pro" || p === "premium") {
            setPlanForCheckout(p);
          }

          setRemainingMonth(
            res.remaining_this_month !== undefined
              ? res.remaining_this_month
              : null
          );
          // null / undefined → 無制限扱い
          setFollowupsPerHand(
            res.followups_per_hand === null ||
            res.followups_per_hand === undefined
              ? null
              : res.followups_per_hand
          );
          setFollowupsUsedThisHand(0);
        }
      } catch (e) {
        console.error("fetchPlan failed:", e);
      }
    })();
  }, []);

  /* 左ペイン */
const [players, setPlayers] = useState(6);
const [heroSeat, setHeroSeat] = useState("UTG");
// 新規ハンドの初期値は defaultStack を使いたいので null 開始にする
const [heroStack, setHeroStack] = useState(null);

  /* engine */
const [recording, setRecording] = useState(false);
const [S, setS] = useState(null);

useEffect(() => {
  // 記録中は座席を作り直さない
  if (recording) return;
  setS(E.initialState(players, heroSeat, heroStack));
}, [players, heroSeat, heroStack]); // ★ recording を依存から外す

// ★ defaultStack を変更したら、全座席のスタックを一括更新
useEffect(() => {
  if (!S) return;

  const v = Number(defaultStack);
  if (!Number.isFinite(v)) return;

  // 記録中に上書きしたくないならここで止める（必要ならONにします）
  // if (recording) return;

  setS((prev) => {
    if (!prev) return prev;
    const nx = structuredClone(prev);
    const len = (nx.seats?.length ?? 0) || Math.max(2, players);
    nx.stacks = Array.from({ length: len }, () => Math.max(0, +v.toFixed(2)));
    return nx;
  });

  // heroStack（解析payload用）も合わせる
  setHeroStack(Math.max(0, +v.toFixed(2)));
}, [defaultStack]); 

  /* result */
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [followupQ, setFollowupQ] = useState("");
  const [followupRes, setFollowupRes] = useState(null);
  const [followupUsed, setFollowupUsed] = useState(false);
  const [sendingFU, setSendingFU] = useState(false);

  // ★ 追い質問の会話ログ（1ハンド内のチャット履歴）
  const [conversation, setConversation] = useState([]);

  // ★ hand_histories の行ID（今はほぼ未使用だが残しておく）
  const [historyId, setHistoryId] = useState(null);

  // ★ hand_histories.hand_id（追い質問保存時に使うキー）
  const [historyHandId, setHistoryHandId] = useState(null);

    /* plan / followup usage */
  const [plan, setPlan] = useState(null);
  const [remainingMonth, setRemainingMonth] = useState(null);
  const [followupsPerHand, setFollowupsPerHand] = useState(null);
  const [followupsUsedThisHand, setFollowupsUsedThisHand] = useState(0);

/* cards */
const [heroCards, setHeroCards] = useState([]);
const [villainCards, setVillainCards] = useState([]);
const [board, setBoard] = useState({ FLOP: [], TURN: [], RIVER: [] });

/* 任意レイズ入力用 */
const [raiseTo, setRaiseTo] = useState("");  // 例: "12.5"

  /* modals */
  const [showHero, setShowHero] = useState(false);
  const [showVillain, setShowVillain] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showPost, setShowPost] = useState(false);
  /* stage */
  const [stageRef, stage] = useSize();
  const width  = Math.max(stage.w, 900);
  const height = Math.max(stage.h, 620);

const seatGeom = useMemo(() => {
  const seatsList = buildSeatsList(S, players);
  const n = seatsList.length;
  if (n <= 0) return { rx: 0, ry: 0, points: [] };

  // 座席カードの見込みサイズ＋安全余白
  const SEAT_W = 130;  // 横
  const SEAT_H = 84;   // 縦
  const PAD    = 40;   // テーブル縁からの安全距離

  // ステージ実寸の中心
  const cx = width / 2;
  const cy = height / 2;

  // はみ出しを確実に避ける半径（座席サイズと余白を控除）
  const rx = Math.max(120, Math.floor((width  - SEAT_W - 2 * PAD) / 2) - 6);
  const ry = Math.max( 90, Math.floor((height - SEAT_H - 2 * PAD) / 2) - 6);

  // ヒーローを常に最下部（BTN位置）に回転オフセットで固定
  const heroIdx = Math.max(0, seatsList.findIndex(s => s === heroSeat));
  const offset  = Math.PI / 2 - (2 * Math.PI * heroIdx) / n;

  const points = Array.from({ length: n }, (_, i) => {
    const t = offset + (2 * Math.PI * i) / n;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });

  return { rx, ry, points };
}, [S, players, width, height, heroSeat]);

// ストリート/アクター/ベット変更時にスライダー初期位置を最小レイズへ同期
useEffect(() => {
  if (!S || S.actor < 0) return;
  const inc  = Math.max(1.0, S.lastRaiseSize || 1.0);
  const base = S.lastBetTo || S.currentBet || 0;
  const minTo =
    S.currentBet === 0
      ? (S.street === "PRE" ? 2 : 1)
      : +(base + inc).toFixed(2);
  setRaiseTo(minTo);
}, [S?.actor, S?.street, S?.currentBet, S?.lastRaiseSize]);


/* begin/end/reset */
function begin(){
  // 残留状態を確実にクリア
  setRecording(false);
  setBoard({ FLOP: [], TURN: [], RIVER: [] });
  setResult(null);
  setShowBoard(false);
  setShowPost(false);
  setVillainCards([]);

  // 新しいステートで開始
  const st = E.initialState(players, heroSeat, heroStack);
  setS(st);
  setRecording(true);

  // ハンド未選択ならピッカーを出す
  if (heroCards.length !== 2) setShowHero(true);
}


  function endRecord(){
    setRecording(false);
    setShowPost(true); // 終了ポップアップ
  }
function resetAll(){
  setS(null); setRecording(false);
  setHeroCards([]);
  setVillainCards([]);  
  setBoard({FLOP:[],TURN:[],RIVER:[]});
  setResult(null); setAnalyzing(false);

  // 新規ハンド用に初期スタックを設定値へ戻す
  setHeroStack(defaultStack);
}

  /* engine ops */
  const legal = S ? E.legal(S) : { fold:false, check:false, call:false, bet:false, raise:false };
  const onFold = ()=>{ if(!S) return; const n=structuredClone(S); E.actFold(n); setS(n); };
  const onCheck= ()=>{ if(!S) return; const n=structuredClone(S); E.actCheck(n); setS(n); };
  const onCall = ()=>{ if(!S) return; const n=structuredClone(S); E.actCall(n); setS(n); };
  const onTo   = (to)=>{ if(!S) return; const n=structuredClone(S); E.actTo(n, to); setS(n); };

  /* postflop bet% */
  function onBetPct(pct){
    if(!S) return;
    const sumBets = (S.bets||[]).reduce((a,b)=>a+b,0);
    const basePot = (S.pot||0) + sumBets;
    const want = +(basePot * pct).toFixed(2);
    const already = S.committed[S.actor] ?? 0;
    const to = +(already + want).toFixed(2);
    onTo(to);
  }
  const raisePresets = S ? E.presets(S) : [];
  const showBetPct = !!S && S.street !== "PRE" && S.currentBet === 0;

/* ボード入力の自動起動 + ハンド終了の検知（堅牢版） */
useEffect(()=>{
  if (!recording || !S) return;

  // 行動者がいない → ハンド終了
  if (S.actor < 0) {
    if (recording) setRecording(false);
    setShowPost(true);
    return;
  }

  // ストリートごとの必要枚数
  const need = S.street === "FLOP" ? 3 : (S.street === "TURN" ? 1 : (S.street === "RIVER" ? 1 : 0));
  const cur  = S.street === "FLOP" ? board.FLOP.length : (S.street === "TURN" ? board.TURN.length : (S.street === "RIVER" ? board.RIVER.length : 0));

  // まだ足りていなければボード入力を開く
  if (need > 0 && cur < need && !showBoard) {
    setShowBoard(true);
  }
}, [
  recording,
  S,                     // Sの中身丸ごと監視（street/actor/bets等の遷移取りこぼし防止）
  board.FLOP.length,
  board.TURN.length,
  board.RIVER.length,
  showBoard
]);




  const onPickHero = (cs)=>{ setHeroCards(cs); setShowHero(false); };
  const onPickBoard = (cs)=>{
    setBoard(prev=>{
      const next={...prev};
      if(S.street==="FLOP") next.FLOP=cs.slice(0,3);
      else if(S.street==="TURN") next.TURN=[cs[0]];
      else if(S.street==="RIVER") next.RIVER=[cs[0]];
      return next;
    });
    setShowBoard(false);
  };

  /* payload */
function buildPayload() {
  const payload = {
    hero: {
      seat: heroSeat,
      cards: heroCards,
      stack_bb: Number(heroStack ?? defaultStack) || 100,
    },
    board,
    actions: S?.actions || { PRE: [], FLOP: [], TURN: [], RIVER: [] },
    config: { players },
  };

  // ショーダウンで相手ハンドが分かる場合だけ付与
  if (villainCards.length === 2) {
    payload.villain = { cards: villainCards };
  }

  return payload;
}

/* analyze */
async function doAnalyze() {
  if (analyzing) return;

  // B案：解析はログイン必須
  if (!auth.loggedIn) {
    alert("解析するにはログインが必要です。ログイン画面へ移動します。");
    window.location.href = "login.html";
    return;
  }

  // 新しい解析開始時に追い質問ログと historyId / handId をリセット
  setConversation([]);
  setHistoryId(null);
  setHistoryHandId(null);

  // この場で「解析してよい状態か」を判定する
  const hasActs =
    !!S &&
    !!S.actions &&
    ["PRE", "FLOP", "TURN", "RIVER"].some(
      (st) => (S.actions[st] || []).length > 0
    );

  const ready =
    !recording &&          // 記録が終了している
    !!S &&                 // ステートが存在する
    heroCards.length === 2 && // ヒーローハンドが2枚ある
    hasActs;               // 何らかのアクションがある

  if (!ready) {
    alert("ハンド入力が完了していないため、まだ解析できません。");
    return;
  }

  // 新しい解析開始時に追い質問カウンタをリセット
  setFollowupsUsedThisHand(0);
  setFollowupUsed(false);

  setAnalyzing(true);

  try {
    const u = JSON.parse(localStorage.getItem("pa_user") || "{}");

    // hand情報を組み立て
    const base = buildPayload();
    const payload = { ...base, user_id: u.user_id || null };

    // 解析リクエスト送信
    const res = await analyzeHand(payload);

    // usage 情報があれば月間残り回数を更新
    if (res && res.usage) {
      const limit = res.usage.limit_per_month;
      const used = res.usage.used_this_month;
      if (limit === null || limit === undefined) {
        // null/undefined は無制限
        setRemainingMonth(null);
      } else {
        const rem = limit - used;
        setRemainingMonth(rem < 0 ? 0 : rem);
      }
    }

    // 解析結果の正規化（ここで必ず ev を完成させる）
    let ev = res?.evaluation || res;
    if (!ev) throw new Error("解析結果が空でした。");
    if (typeof ev === "string") {
      try {
        const parsed = JSON.parse(ev);
        if (parsed && typeof parsed === "object") ev = parsed;
      } catch {
        // プレーンテキストはそのまま markdown として扱う
        ev = { markdown: ev };
      }
    }

    // markdown を多形対応で補完（どれか一つでも入っていれば表示できる）
    const md =
      ev?.markdown ??
      res?.markdown ??
      res?.result?.markdown ??
      ev?.text ??
      ev?.message ??
      "";

    // ev をオブジェクト化し markdown を必ず持たせる
    if (typeof ev !== "object" || ev === null) ev = {};
    ev = { ...ev, markdown: md };

    // ★ このハンド専用の handId を一度だけ決める
    const handId = historyHandId || `hand_${Date.now()}`;

    // 表示用オブジェクトを作ってから一度だけ描画
    const wrapped = {
      evaluation: {
        ...ev,
        handId,
      },
      snapshot: {
        ...payload,
        handId,
        evaluation: {
          ...ev,
          handId,
        },
      },
    };

    setResult(wrapped);
    setFollowupQ("");
    setFollowupRes(null);
    setFollowupUsed(false);
    setShowResultModal(true);

    // ---- 履歴を hand_histories に保存 ----
    try {
      const u2 = JSON.parse(localStorage.getItem("pa_user") || "{}");

      if (u2 && u2.user_id) {
        // ★ さっき決めた handId をそのまま使う
        const saved = await saveHistory({
          user_id: u2.user_id,
          hand_id: handId,
          snapshot: wrapped.snapshot,
          evaluation: wrapped.evaluation,
          conversation: [],                // 追い質問はあとで update で反映
          markdown: ev?.markdown || "",
        });
        // /history/save が返す id と hand_id を保持しておく
        if (saved && saved.ok && saved.id) {
          setHistoryId(saved.id);
          setHistoryHandId(handId);     // ★ state にも保持（次回解析時に再利用可）
        } else {
          console.warn("saveHistory did not return id:", saved);
        }
      } else {
        console.warn("saveHistory skipped: no user_id in pa_user");
      }
    } catch (e) {
      console.error("saveHistory error:", e);
    }


    // 旧ローカル履歴保存
    try {
      const rows = loadHist();
      const json = JSON.stringify(payload);

      const idx = rows.findIndex(
        (r) => r.payload && JSON.stringify(r.payload) === json
      );

      if (idx >= 0) {
        rows[idx] = { ...rows[idx], evaluation: ev };
      } else {
        rows.unshift({
          id: uid(),
          ts: Date.now(),
          payload,
          evaluation: ev,
        });
      }

      saveHist(rows.slice(0, 200));
    } catch (err) {
      console.warn("history save failed:", err);
    }
  } catch (err) {
    console.error("[doAnalyze] error:", err);
    setResult({
      error: true,
      message: String(
        err?.message || err || "解析中にエラーが発生しました。"
      ),
    });
    setShowResultModal(true);
  } finally {
    setAnalyzing(false);
  }
}

  // 追い質問使用回数を ResultModal から反映させるコールバック
  function handleFollowupUsage(usage) {
    if (!usage) return;
    const used = usage.used_for_this_hand ?? 0;
    const limit =
      usage.followups_per_hand ?? 
      followupsPerHand ?? 
      null;

    setFollowupsUsedThisHand(used);

    if (limit != null && used >= limit) {
      setFollowupUsed(true);
    }
  }

// ★ 追加：追い質問の会話ログをサーバーに保存
async function updateConversationOnServer(handId, conversationArray) {
  try {
    const u = JSON.parse(localStorage.getItem("pa_user") || "{}");
    const userId = u?.user_id;
    if (!userId || !handId || !Array.isArray(conversationArray)) return;

    // api.js の関数を使い、user_id と hand_id を正しく送る
    await updateHistoryConversation(userId, handId, conversationArray);
  } catch (err) {
    console.error("updateConversation failed:", err);
  }
}

// 追い質問（1ハンド1回まで）
async function sendFollowup() {
  if (!result || !result.snapshot) return;
  if (followupUsed) return;                // 制限
  const q = followupQ.trim();
  if (!q) return;
  if (sendingFU) return;

  setSendingFU(true);
  try {
    const body = {
      snapshot: result.snapshot,
      evaluation: result.evaluation,
      question: q,
    };
    const res = await followupQuestion(body);
    const fu = res.result || res;

    // アシスタント側のテキストを取り出し
    const assistantText = fu?.message || fu?.markdown || "";

    // --- 会話ログを追記 ---
    const nextConversation = [
      ...conversation,
      { role: "user", message: q },
      { role: "assistant", message: assistantText },
    ];
    setConversation(nextConversation);
    setFollowupRes(fu);

    // ★ サーバー側の hand_histories.conversation を更新
    if (historyHandId) {
      updateConversationOnServer(historyHandId, nextConversation);
    }

    // 追い質問使用回数を更新
    if (res.followup_usage) {
      const used = res.followup_usage.used_for_this_hand;
      const limit = res.followup_usage.followups_per_hand ?? 1;

      setFollowupsUsedThisHand(used);

      if (used >= limit) {
        setFollowupUsed(true);
      }
    }

  } catch (e) {
    setFollowupRes({
      refusal: true,
      message: `送信に失敗しました: ${String(e?.message || e)}`,
    });
  } finally {
    setSendingFU(false);
  }
}

  /* post modal actions */
  function saveOnly(){
    const rows = loadHist();
    rows.unshift({ id: uid(), ts: Date.now(), payload: buildPayload() });
    saveHist(rows);
    setShowPost(false);
  }
  async function saveAndAnalyze(){
    saveOnly();
    await doAnalyze();
  }
  async function analyzeNow(){
    setShowPost(false);
    await doAnalyze();
  }

  const hasActions =
    !!S &&
    !!S.actions &&
    ["PRE", "FLOP", "TURN", "RIVER"].some(
      (st) => (S.actions[st] || []).length > 0
    );

  // 残り回数が 0 のときは解析不可
const canAnalyze =
  auth.loggedIn &&
  !recording &&
  !!S &&
  heroCards.length === 2 &&
  hasActions &&
  (remainingMonth === null || remainingMonth > 0);
  /* UI */

return (

  <>

<header className="topbar">
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div className="logo-pill">Poker Analyzer</div>
    <div className="top-title">ハンド記録</div>
  </div>
  <div
    className="top-right"
    style={{ display: "flex", alignItems: "center", gap: 16 }}
  >
    {/* プラン情報（1つだけ表示） */}
    {plan && (
      <div
        style={{
          fontSize: 13,
          color: "#d1d5db",
          textAlign: "right",
          lineHeight: 1.4,
        }}
      >
        <div>{plan.toUpperCase()} プラン</div>
        <div>
          解析 残り{" "}
          {remainingMonth === null ? "∞" : `${remainingMonth} 回`}
        </div>
      </div>
    )}

{auth.loggedIn ? (
  <>
    {/* プラン変更ボタン */}
    <button className="btn" onClick={() => setShowPlanModal(true)}>
      プラン変更
    </button>

    <button
      className="btn glow"
      onClick={() => {
        window.location.href = "history.html";
      }}
    >
      履歴
    </button>

    <button className="btn glow" onClick={() => setShowSettings(true)}>
      設定
    </button>
  </>
) : (
  <>
    <button className="btn glow btn-accent" onClick={() => (window.location.href = "login.html")}>
      ログイン
    </button>
  </>
)}
  </div>
</header>

{!auth.loggedIn && (
  <div className="login-banner">
    <div className="login-banner__title">Poker Analyzer</div>
    <div className="login-banner__text">
      ハンド記録UIは体験できます。解析・履歴・課金機能はログインが必要です。
    </div>
    <div className="login-banner__actions">
      <button className="btn glow btn-accent" onClick={() => (window.location.href = "login.html")}>
        Googleでログインして解析する
      </button>
    </div>
  </div>
)}


    <main className="page">
<section className="panel" style={{padding:16}}>
  <div
    style={{
      display:"grid",
      gridTemplateColumns: "minmax(220px, 12vw) 1fr",
      gap:16,
      alignItems:"start",
      height:"100%"
    }}
  >

    {/* 左：セットアップ＋LOG */}
    <div style={{display:"flex", flexDirection:"column", gap:12}}>
      <div className="panel">
        <label>Players
<select
  value={players}
  onChange={e=>setPlayers(Number(e.target.value))}
  disabled={recording}
  style={{width:"100%",marginTop:4}}
>
  {[2,3,4,6,7,8,9].map(n => (
    <option key={n} value={n}>{n}</option>
  ))}
</select>
        </label>

        <label style={{marginTop:8}}>Hero Seat
          <select
            value={heroSeat}
            onChange={e=>setHeroSeat(e.target.value)}
            disabled={recording}
            style={{width:"100%",marginTop:4}}
          >
            {(S?.seats ?? (players<=2?["BTN","BB"]:["UTG","UTG+1","LJ","HJ","CO","BTN","SB","BB"])).map(s=>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
        </label>

        <label style={{marginTop:8}}>Hero Stack (BB)
          <input
            type="number"
            value={heroStack ?? defaultStack}
            onChange={e=>setHeroStack(e.target.value)}
            disabled={recording}
            style={{width:"100%",marginTop:4}}
          />
        </label>

<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
  <button className="btn" onClick={resetAll} style={{ flex: 1 }}>
    リセット
  </button>
</div>

        <div style={{display:"flex",gap:8, marginTop:8}}>
          {!recording
            ? <button className="btn glow btn-accent" onClick={begin} style={{flex:1}}>記録開始</button>
            : <button className="btn glow btn-danger" onClick={endRecord} style={{flex:1}}>記録終了</button>}
        </div>
{/* 解析ボタン（ハンド入力完了後のみ有効） */}
<div style={{ display: "flex", gap: 8, marginTop: 8, flexDirection: "column" }}>
  <button
    className="btn glow btn-accent"
    onClick={doAnalyze}
    disabled={!canAnalyze || analyzing}
    style={{ flex: 1 }}
  >
    解析
  </button>

  {remainingMonth !== null && remainingMonth <= 0 && (
    <div style={{ fontSize: 12, color: "#f97373", textAlign: "center" }}>
      今月の解析回数の上限に達しました。プランをアップグレードすると回数を増やせます。
    </div>
  )}
</div>


      </div>

      <div className="panel">
        <div style={{fontWeight:700,marginBottom:8}}>LOG</div>
        <pre className="kbd" style={{margin:0,whiteSpace:"pre-wrap"}}>
{["PRE","FLOP","TURN","RIVER"].map(st => `${st}: ${S ? line(S.actions, st) : ""}`).join("\n")}
        </pre>
      </div>
    </div>

    {/* 右：テーブル＋アクション */}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
{/* 外側は .panel の余白を保持。座標系は内側の stage で統一 */}
<div className="panel" style={{ padding: 16 }}>
  <div
    ref={stageRef}
    style={{
      position: "relative",
      width: "900px",   // ★ 固定幅
      height: "620px",  // ★ 固定高さ
      margin: "0 auto", // ★ パネル内で中央寄せ
      padding: 0,              // 寸法は clientWidth/Height を使う
      boxSizing: "border-box", // 枠線分を含めた実寸基準に統一
      overflow: "hidden",
      borderRadius: 12,
    }}
  >

    {/* 楕円（座席中心が縁に一致） */}
    <svg
  width="100%" height="100%"
  viewBox={`0 0 ${Math.round(width)} ${Math.round(height)}`}
  preserveAspectRatio="xMidYMid meet"
>

      <ellipse
        cx={width / 2}
        cy={height / 2}
        rx={seatGeom.rx}
        ry={seatGeom.ry}
        fill="none"
        stroke="#2a3b4f"
        strokeWidth="3"
      />
    </svg>

    {/* 座席 */}
    {buildSeatsList(S, players).map((s, i) => {
      const p = seatGeom.points[i];
      const active = !!(recording && S && i === S.actor);
      const isHero = s === heroSeat;

      return (
        <div
          key={s}
          onClick={(e) => {
            if (!S) return;
            e.stopPropagation();
            const cur = S?.stacks?.[i] ?? 0;
            const v = window.prompt(`${s} のスタック(BB)を入力`, String(cur));
            if (v === null) return;
            const n = Number(v);
            if (!Number.isFinite(n)) {
              alert("数値で入力してください");
              return;
            }
const nextStack = Math.max(0, +n.toFixed(2));

setS((prev) => {
  const nx = structuredClone(prev);
  nx.stacks[i] = nextStack;
  return nx;
});

// hero席を触った場合、解析payloadのstack_bbも一致させる
if (s === heroSeat) {
  setHeroStack(nextStack);
}
          }}
          style={{
            cursor: "pointer",
            position: "absolute",
            left: p.x,
            top: p.y,
            transform: "translate(-50%,-50%)",
            width: 120,
            height: 80,
            borderRadius: 12,
            background: active ? "#14263b" : "#0e1d2e",
            border: active ? "2px solid #ffe08a" : "1px solid #29425c",
            color: active ? "#ffe08a" : "#d7e7ff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
          }}
        >
<div style={{ fontWeight: 700, marginBottom: 2 }}>
  {isHero ? `${s} (YOU)` : s}
</div>
<div>
  Stack: {(S?.stacks?.[i] ?? defaultStack).toFixed(2)} BB
</div>
{!!(S?.bets?.[i] ?? 0) && (
  <div style={{ fontSize: 11, opacity: 0.9 }}>Bet: {(S?.bets?.[i] ?? 0).toFixed(2)} BB</div>
)}

          {!!S?.folded?.[i] && <div style={{ fontSize: 11, marginTop: 4, color: "#9bb" }}>FOLDED</div>}
          {isHero && heroCards.length === 2 && (
            <div style={{ marginTop: 4 }}>
              {heroCards.map((c, idx) => (
                <span key={idx} style={{ margin: "0 2px" }}>
                  {pretty(c, "small")}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    })}

{/* 中央：POT + ボード */}
<div
  style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    pointerEvents: "none",
  }}
>
  <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 1, color: "#d7e7ff" }}>
    POT {(S?.pot ?? 0).toFixed(2)}BB
  </div>
  <div style={{ display: "flex", gap: 8 }}>
    {[...board.FLOP, ...board.TURN, ...board.RIVER].map((c, i) => (
      <div
        key={i}
        title={c}
        style={{
          width: 46,
          height: 60,
          borderRadius: 10,
          border: "1px solid #1b2a41",
          background: "#0f1b2b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#dbe8ff",
          boxShadow: "inset 0 0 0 1px #20354d",
        }}
      >
        <PrettyBoardCard card={c} />
      </div>
    ))}
  </div>
</div>


    {/* ボード入力 */}
    {showBoard && S && (

      <BoardPickerModal
        open={showBoard}
        street={S.street}
        used={[...heroCards, ...board.FLOP, ...board.TURN, ...board.RIVER]}
        initial={S.street === "FLOP" ? board.FLOP : S.street === "TURN" ? board.TURN : board.RIVER}
        onClose={() => setShowBoard(false)}
        onPick={(cards) => {
          setBoard((prev) => {
            const next = { ...prev };
            if (S.street === "FLOP") next.FLOP = cards.slice(0, 3);
            else if (S.street === "TURN") next.TURN = cards.slice(0, 1);
            else if (S.street === "RIVER") next.RIVER = cards.slice(0, 1);
            return next;
          });
          setShowBoard(false);
        }}
      />
    )}
{/* ステータスバー（テーブル左下） */}
{S && (
<div
  style={{
    position: "absolute",
    left: 12,
    bottom: 8,
    fontSize: 10,
    color: "#6b7280",          // 少し薄いグレー
    padding: 0,                // 枠と余白なし
    background: "transparent", // 背景なし
  }}
>
    {(() => {
      const street = S.street || "PRE";
      const actorSeat =
        S.actor >= 0
          ? (S.seats && S.seats[S.actor]) || `Seat${S.actor + 1}`
          : "-";
      const pot = (S.pot ?? 0).toFixed(2);
      const toCall =
        S.actor >= 0
          ? Math.max(
              0,
              (S.currentBet ?? 0) - (S.committed?.[S.actor] ?? 0)
            ).toFixed(2)
          : "0.00";

      return `Actor: ${actorSeat}   Street: ${street}   Pot: ${pot} BB   To call: ${toCall} BB`;
    })()}
  </div>
)}

  </div>
</div>


      {/* アクションバー */}
      <div className="panel" style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        {recording && S && S.actor>=0 ? (
          <>
            <button className="btn glow" onClick={onFold} disabled={!legal.fold}>Fold</button>

            {S.currentBet===0
              ? <button className="btn glow" onClick={onCheck} disabled={!legal.check}>Check</button>
              : <button className="btn glow" onClick={onCall} disabled={!legal.call}>Call</button>
            }

{/* === Raise UI（セグメント＋充填スライダー／±ボタン無し） === */}
{S && (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 360 }}>
{/* プリセット（チップ風） */}
<div className="chip-group">
  {(() => {
    const inc  = Math.max(1.0, S.lastRaiseSize || 1.0);
    const base = S.lastBetTo || S.currentBet || 0;

    if (S.street === "PRE" && S.currentBet === 0) {
      // オープン（絶対額）
      return [2, 2.5, 3, 4, 5].map((bb) => {
        const to = +bb.toFixed(2);
        const active = Number(raiseTo) === to;
        return (
          <button key={`open-${bb}`} className={`chip ${active ? "active" : ""}`} onClick={() => setRaiseTo(to)}>
            {fmtBB(to)}
          </button>
        );
      });
    }

    if (S.street === "PRE") {
      // 再レイズ（k倍、最小尊重）
      const minTo = +(base + inc).toFixed(2);
      return [2, 2.5, 3, 4, 5].map((k) => {
        const cand   = +(base * k).toFixed(2);
        const to     = Math.max(cand, minTo);
        const active = Number(raiseTo) === to;
        return (
          <button key={`rr-${k}`} className={`chip ${active ? "active" : ""}`} onClick={() => setRaiseTo(to)}>
            {`${k}x(${fmtBB(to)})`}
          </button>
        );
      });
    }

    // ポストフロップ（Pot％）
    const sumBets = (S.bets || []).reduce((a, b) => a + b, 0);
    const potBase = (S.pot || 0) + sumBets;
    const pctList = [0.25, 0.33, 0.5, 0.66, 0.75, 1.0, 1.25];
    return pctList.map((p) => {
      const want    = +(potBase * p).toFixed(2);
      const already = S.committed[S.actor] ?? 0;
      const to      = +(already + want).toFixed(2);
      const active  = Number(raiseTo) === to;
      return (
        <button key={`pct-${p}`} className={`chip ${active ? "active" : ""}`} onClick={() => setRaiseTo(to)}>
          {`${Math.round(p * 100)}% (${fmtBB(to)})`}
        </button>
      );
    });
  })()}
</div>


    {/* 下段：固定幅の「Raise To …BB」＋充填スライダー */}
    {(() => {
      const inc  = Math.max(1.0, S.lastRaiseSize || 1.0);
      const base = S.lastBetTo || S.currentBet || 0;
      const minTo =
        S.currentBet === 0 ? (S.street === "PRE" ? 2 : 1) : +(base + inc).toFixed(2);
      const maxTo = +((S.committed?.[S.actor] || 0) + (S.stacks?.[S.actor] || 0)).toFixed(2);
      const value = Number.isFinite(raiseTo) ? raiseTo : minTo;
      const pct   = ((value - minTo) / Math.max(1e-9, (maxTo - minTo))) * 100;

      return (
        <>
          <div className="raise-wrap">
            <button
              className="btn btn--primary raise-fixed"
              onClick={() => { if (Number.isFinite(value)) onTo(+Number(value).toFixed(2)); }}
              title="決定"
            >
              {`Raise To ${fmtBB(value)}`}
            </button>

            <input
              type="range"
              className="bb-slider"
              style={{ flex: 1, ["--pct"]: pct }}
              min={minTo}
              max={Math.max(minTo, maxTo)}
              step={0.5}
              value={value}
              onChange={(e) => setRaiseTo(+e.target.value)}
            />
          </div>
          <div className="bb-ticks"><span /><span /><span /></div>
        </>
      );
    })()}
  </div>
)}

            <button
              className="btn glow btn-danger"
              onClick={()=> onTo((S?.committed?.[S.actor]??0) + (S?.stacks?.[S.actor]??0))}
            >
              All-in
            </button>
          </>
          
        ) : (
          <div style={{opacity:.7}}>「記録開始」で進行。座席をクリックすることでスタックを調整できます。</div>
        )}
      </div>{/* 右カラム end */}
    </div>{/* 左+右カラムを包む grid 親 end */}
  </div>{/* page内レイアウトwrapper（存在する場合） */}
</section>
</main> 
{showResultModal && result && (
  <ResultModal
    open={showResultModal}
    onClose={() => setShowResultModal(false)}
    result={{
      ...result,
      handId: result?.evaluation?.handId,
      snapshot: result?.snapshot || {
        hero: {
          seat: heroSeat,
          cards: heroCards,
          stack_bb: Number(heroStack) || 100,
        },
        board,
        actions: S?.actions || { PRE: [], FLOP: [], TURN: [], RIVER: [] },
        config: { players },
        handId: result?.evaluation?.handId,
      },
      // ★★★ これがないと履歴から開いたときに会話が読めない
      conversation: result?.conversation ?? [],
    }}
    followupsPerHand={followupsPerHand}
    followupsUsed={followupsUsedThisHand}
    onFollowupUsage={handleFollowupUsage}
  />
)}

{/* ===== Modals ===== */}

{showPost && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}
    onClick={(e) => {
      // 背景クリックで閉じたい場合
      // if (e.target === e.currentTarget) setShowPost(false);
    }}
  >
    <div
      style={{
        width: 540,
        maxWidth: "92vw",
        background: "#0b1621",
        border: "1px solid #203040",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 12px 40px rgba(0,0,0,.45)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ===== ハンド保存/解析モーダル本体 ===== */}
      <h2
        style={{
          fontSize: 18,
          color: "#e5e7eb",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        ハンドの保存 / 解析
      </h2>

      <div
        style={{
          fontSize: 13,
          color: "#d1d5db",
          lineHeight: 1.8,
          marginBottom: 16,
        }}
      >
        ・このハンドを解析する
        <br />
        ・履歴に保存して後で解析
        <br />
        ・保存して解析
        <br />
        ・ショーダウンまで進んだ場合は相手のハンドも任意で入力できます。
      </div>

      {/* 相手ハンド入力（任意） */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          padding: "8px 0",
        }}
      >
        <div style={{ fontSize: 13, color: "#d1d5db" }}>
          相手ハンド（任意）：
        </div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          {villainCards.length === 2
            ? villainCards.join(" ")
            : "未入力"}
        </div>
        <button
          className="btn glow"
          onClick={() => setShowVillain(true)}
          style={{ marginLeft: 12 }}
        >
          入力 / 編集
        </button>
      </div>

      {/* ボタン群 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <button
          className="btn"
          style={{ flex: 1 }}
          onClick={() => {
            setShowPost(false);
            doAnalyze();
          }}
        >
          解析
        </button>

        <button
          className="btn glow"
          style={{ flex: 1 }}
          onClick={() => {
            saveOnly();
            setShowPost(false);
          }}
        >
          履歴に保存
        </button>

        <button
          className="btn"
          style={{ flex: 1 }}
          onClick={() => {
            saveAndAnalyze();
            setShowPost(false);
          }}
        >
          保存して解析
        </button>
      </div>
    </div>
  </div>
)}

{/* ===== ヒーローカード選択モーダル ===== */}
{showHero && (
  <CardPickerModal
    open={showHero}
    initialCards={heroCards}
    exclude={[
      ...board.FLOP,
      ...board.TURN,
      ...board.RIVER,
      ...villainCards,
    ]}
    onConfirm={onPickHero}
    onCancel={() => setShowHero(false)}
  />
)}

{/* ===== 相手ハンド入力モーダル ===== */}
{showVillain && (
  <CardPickerModal
    open={showVillain}
    initialCards={villainCards}
    exclude={[
      ...board.FLOP,
      ...board.TURN,
      ...board.RIVER,
      ...heroCards,
    ]}
    onConfirm={(cs) => {
      setVillainCards(cs.slice(0, 2)); // 2枚まで
      setShowVillain(false);
    }}
    onCancel={() => setShowVillain(false)}
  />
)}

{/* ===== プラン変更モーダル ===== */}
{showPlanModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1100,
    }}
    onClick={(e) => {
      if (e.target === e.currentTarget) setShowPlanModal(false);
    }}
  >
    <div
      style={{
        width: 520,                // ★ すこし広めに
        maxWidth: "92vw",
        background: "#0b1621",
        border: "1px solid #203040",
        borderRadius: 12,
        padding: 20,               // ★ 余白も増やす
        boxShadow: "0 12px 40px rgba(0,0,0,.45)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h2
        style={{
          fontSize: 18,
          color: "#e5e7eb",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        プランの変更
      </h2>

      <p
        style={{
          fontSize: 13,
          color: "#d1d5db",
          lineHeight: 1.6,
          marginBottom: 12,
        }}
      >
        以下から希望のプランを選び、
        決済へお進みください。
      </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[
            {
              id: "basic",
              label: "Basic（月30回）",
              note: "広告なし・追い質問つき",
              price: "月額 980円",
              tag: "おすすめ",
            },
            {
              id: "pro",
              label: "Pro（月100回）",
              note: "ヘビーユーザー向け",
              price: "月額 1,480円",
              tag: "たくさん解析したい方",
            },
            {
              id: "premium",
              label: "Premium（回数無制限）",
              note: "プロ志向の方向け",
              price: "月額 2,480円",
              tag: "本気で打ち込みたい方",
            },
          ].map((p) => {

          const selected = planForCheckout === p.id;
          return (
            <label
              key={p.id}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 10,
                width: "100%",
                border: selected ? "1px solid #60a5fa" : "1px solid #1f2933",
                background: selected
                  ? "radial-gradient(circle at top left, rgba(96,165,250,0.18), #030712)"
                  : "#050910",
                boxShadow: selected
                  ? "0 0 0 1px rgba(96,165,250,0.35), 0 4px 12px rgba(0,0,0,0.45)"
                  : "0 2px 6px rgba(0,0,0,0.35)",
                cursor: "pointer",
                transition: "all .18s ease-out",
              }}
              onClick={() => setPlanForCheckout(p.id)}
            >
              {/* 左カラム：ラジオボタンだけ（固定幅） */}
              <div
                style={{
                  width: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <input
                  type="radio"
                  name="plan"
                  value={p.id}
                  checked={selected}
                  onChange={() => setPlanForCheckout(p.id)}
                  style={{
                    width: 18,
                    height: 18,
                    margin: 0,
                  }}
                />
              </div>

              {/* 中央：プラン名＋料金＋説明（広めのスペース） */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: "#e5e7eb",
                    fontWeight: 600,
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.label}
                </div>

                {p.price && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#f97316", // ちょっと目立つオレンジ
                      fontWeight: 600,
                      marginBottom: 2,
                    }}
                  >
                    {p.price}
                  </div>
                )}

                <div
                  style={{
                    fontSize: 12,
                    color: "#9ca3af",
                    lineHeight: 1.5,
                  }}
                >
                  {p.note}
                </div>
              </div>

              {/* 右端：タグ（小さめバッジ） */}
              {p.tag && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "4px 8px",
                    borderRadius: 999,
                    backgroundColor: selected ? "#1d4ed8" : "#111827",
                    color: "#e5e7eb",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {p.tag}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 16,
        }}
      >
        <button
          className="btn"
          onClick={() => setShowPlanModal(false)}
        >
          閉じる
        </button>
        <button
          className="btn glow btn-accent"
          onClick={async () => {
            try {
              const u = JSON.parse(
                localStorage.getItem("pa_user") || "null"
              );
              if (!u || !u.user_id) {
                alert("ログイン情報が見つかりません。再ログインしてください。");
                return;
              }

              const resp = await createCheckoutSession({
                user_id: u.user_id,
                email: u.email || "",
                plan: planForCheckout,
              });

              if (resp && resp.ok && resp.url) {
                window.location.href = resp.url;
              } else if (resp && resp.url) {
                window.location.href = resp.url;
              } else {
                alert("決済画面のURLを取得できませんでした。");
              }
            } catch (e) {
              console.error(e);
              alert(`決済の開始に失敗しました: ${String(e?.message || e)}`);
            }
          }}
        >
          決済へ進む
        </button>
      </div>
    </div>
  </div>
)}

{/* ===== 設定モーダル ===== */}
<SettingsModal
  open={showSettings}
  onClose={() => setShowSettings(false)}
  userInfo={userInfo}
  plan={plan}
  remainingMonth={remainingMonth}
  defaultStack={defaultStack}
  setDefaultStack={setDefaultStack}
  onLogout={handleLogout}
/>

{analyzing && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1500,
    }}
  >
    <div
      style={{
        minWidth: 260,
        maxWidth: 320,
        padding: "16px 20px",
        borderRadius: 12,
        background:
          "radial-gradient(circle at top, rgba(59,130,246,0.35), #020617 55%)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.7)",
        border: "1px solid rgba(148,163,184,0.4)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        解析中...
      </div>
      <div style={{ fontSize: 12, color: "#cbd5f5", lineHeight: 1.6 }}>
        数秒〜十数秒ほどかかる場合があります。
        <br />
        そのままお待ちください。
      </div>
    </div>
  </div>
)}

</>
);
}


