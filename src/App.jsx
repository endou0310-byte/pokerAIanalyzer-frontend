import React, { useEffect, useMemo, useRef, useState } from "react";
import { analyzeHand, followupQuestion, saveHistory, fetchPlan, createCheckoutSession, createPortalSession, updateHistoryConversation, changePlan, } from "./api.js";
import CardPickerModal from "./components/CardPickerModal.jsx";
import BoardPickerModal from "./components/BoardPickerModal.jsx";
import ResultModal from "./components/ResultModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import ActionBar from "./components/ActionBar.jsx";
import * as E from "./lib/engine.js";
// バックエンドのベースURL（.env の VITE_API_BASE）
const API_BASE = import.meta.env.VITE_API_BASE || "";

/* ====== layout utils ====== */
function useSize() {
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
const suitSym = { s: "♠", h: "♥", d: "♦", c: "♣" };
const pretty = (c, cls = "") => {
  if (!c) return null;
  const r = c[0], s = c[1];
  const red = s === "h" || s === "d" ? "s-red" : "s-black";
  return <span className={`cardStr ${cls} ${red}`}>{r}{suitSym[s]}</span>;
};

// BB表示を 3.00→3 / 6.50→6.5 に丸める
function fmtBB(n) {
  const x = Number(n ?? 0);
  const s = x.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
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
  const t = (a.type || "").toUpperCase();
  if (t === "FOLD" || t === "CHECK") return `${a.actor} ${t}`;
  if (t === "CALL") return `${a.actor} Call ${fmtBB(a.put)}`;
  if (t === "BET") return `${a.actor} Bet ${fmtBB(a.put)}`;
  if (t === "RAISE") return `${a.actor} Raise ${fmtBB(a.to)}`;
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
const uid = () => Math.random().toString(36).slice(2, 10);


// Sが未生成でも座席を描画するためのデフォルト座席
const FALLBACK_SEATS = ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB", "Seat9", "Seat10"];
const buildSeatsList = (S, players) =>
  (S?.seats ?? FALLBACK_SEATS).slice(0, Math.max(2, players));


/* ====== main ====== */
export default function App() {

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
  // 初期値は localStorage から取得（F5対策）
  const [defaultStack, setDefaultStack] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("pa_user") || "null");
      return u?.default_stack != null ? Number(u.default_stack) : 100;
    } catch {
      return 100;
    }
  });

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
          `${API_BASE}/auth/me?user_id=${encodeURIComponent(auth.user.user_id)}`
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data?.ok && data?.user?.default_stack != null) {
          const v = Number(data.user.default_stack);
          setDefaultStack(v);
          lastSavedDefaultStackRef.current = v;

          // ★ DBから最新値を取れたら localStorage も更新（F5対策）
          try {
            const u = JSON.parse(localStorage.getItem("pa_user") || "null");
            if (u) {
              u.default_stack = v;
              localStorage.setItem("pa_user", JSON.stringify(u));
            }
          } catch { }

          // heroStack が未設定なら初期表示も合わせる
          setHeroStack((prev) => (prev == null ? v : prev));
        }
      } catch {
        // 取得失敗時は何もしない
      }
    })();
  }, [auth.loggedIn, auth.user?.user_id]);

  // ※ auto-save was removed. SettingsModal now handles manual save.

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
  // 新規ハンドの初期値は defaultStack を使い、即座に反映させる
  const [heroStack, setHeroStack] = useState(defaultStack);

  /* engine */
  const [recording, setRecording] = useState(false);
  const [S, setS] = useState(null);

  useEffect(() => {
    // 記録中は座席を作り直さない
    if (recording) return;
    setS(E.initialState(players, heroSeat, heroStack));
    setHistoryStack([]); // Reset history on new hand
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

  /* Undo History */
  const [historyStack, setHistoryStack] = useState([]);
  const pushHistory = (st) => setHistoryStack(p => [...p, structuredClone(st)]);
  const onUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setS(prev);
    setHistoryStack(p => p.slice(0, -1));
  };

  /* modals */
  const [showHero, setShowHero] = useState(false);
  const [showVillain, setShowVillain] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showPost, setShowPost] = useState(false);
  /* stage */
  const [stageRef, stage] = useSize();

  // 画面全体の幅を監視してレイアウトを決定する
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // スマホ判定: windowWidth を基準にする (初期値0問題を回避)
  const isMobile = windowWidth < 600;

  // テーブル描画用の幅 (stage.w が取れていない初期は windowWidth などでフォールバック)
  // ただしDesktop時は min 900 で描画したいので、レイアウトモードに応じて下限を変える
  const width = Math.max(stage.w, isMobile ? 340 : 900);
  const height = Math.max(stage.h, isMobile ? 400 : 620);

  const seatGeom = useMemo(() => {
    const seatsList = buildSeatsList(S, players);
    const n = seatsList.length;
    if (n <= 0) return { rx: 0, ry: 0, points: [] };

    // 座席カードの見込みサイズ＋安全余白 (スマホ時は小さく)
    const SEAT_W = isMobile ? 80 : 130;
    const SEAT_H = isMobile ? 56 : 84;
    const PAD = isMobile ? 12 : 40;

    // ステージ実寸の中心
    const cx = width / 2;
    const cy = height / 2;

    // はみ出しを確実に避ける半径（座席サイズと余白を控除）
    // Mobile tweak: Slightly squarer aspect ratio (increase ry) to avoid "weapon" look
    const rx = Math.max(isMobile ? 80 : 120, Math.floor((width - SEAT_W - 2 * PAD) / 2) - 6);
    const ry = Math.max(isMobile ? 90 : 90, Math.floor((height - SEAT_H - 2 * PAD) / 2) - 6);

    // ヒーローを常に最下部（BTN位置）に回転オフセットで固定
    const heroIdx = Math.max(0, seatsList.findIndex(s => s === heroSeat));
    // Mobile tweak: Shift rotation slightly if needed, but usually just geometric balance
    const offset = Math.PI / 2 - (2 * Math.PI * heroIdx) / n;

    const points = Array.from({ length: n }, (_, i) => {
      const t = offset + (2 * Math.PI * i) / n;
      return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
    });

    return { rx, ry, points, seatW: SEAT_W, seatH: SEAT_H, isMobile };
  }, [S, players, width, height, heroSeat]);

  // ストリート/アクター/ベット変更時にスライダー初期位置を最小レイズへ同期
  useEffect(() => {
    if (!S || S.actor < 0) return;
    const inc = Math.max(1.0, S.lastRaiseSize || 1.0);
    const base = S.lastBetTo || S.currentBet || 0;
    const minTo =
      S.currentBet === 0
        ? (S.street === "PRE" ? 2 : 1)
        : +(base + inc).toFixed(2);
    setRaiseTo(minTo);
  }, [S?.actor, S?.street, S?.currentBet, S?.lastRaiseSize]);


  /* begin/end/reset */
  function begin() {
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


  function endRecord() {
    setRecording(false);
    setShowPost(true); // 終了ポップアップ
  }
  function resetAll() {
    setS(null); setRecording(false);
    setHeroCards([]);
    setVillainCards([]);
    setBoard({ FLOP: [], TURN: [], RIVER: [] });
    setResult(null); setAnalyzing(false);

    // 新規ハンド用に初期スタックを設定値へ戻す
    setHeroStack(defaultStack);
  }

  /* engine ops */
  const legal = S ? E.legal(S) : { fold: false, check: false, call: false, bet: false, raise: false };
  const onFold = () => { if (!S) return; pushHistory(S); const n = structuredClone(S); E.actFold(n); setS(n); };
  const onCheck = () => { if (!S) return; pushHistory(S); const n = structuredClone(S); E.actCheck(n); setS(n); };
  const onCall = () => { if (!S) return; pushHistory(S); const n = structuredClone(S); E.actCall(n); setS(n); };
  const onTo = (to) => { if (!S) return; pushHistory(S); const n = structuredClone(S); E.actTo(n, to); setS(n); };

  /* postflop bet% */
  function onBetPct(pct) {
    if (!S) return;
    const sumBets = (S.bets || []).reduce((a, b) => a + b, 0);
    const basePot = (S.pot || 0) + sumBets;
    const want = +(basePot * pct).toFixed(2);
    const already = S.committed[S.actor] ?? 0;
    const to = +(already + want).toFixed(2);
    onTo(to);
  }
  const raisePresets = S ? E.presets(S) : [];
  const showBetPct = !!S && S.street !== "PRE" && S.currentBet === 0;

  /* ボード入力の自動起動 + ハンド終了の検知（堅牢版） */
  useEffect(() => {
    if (!recording || !S) return;

    // 行動者がいない → ハンド終了
    if (S.actor < 0) {
      if (recording) setRecording(false);
      setShowPost(true);
      return;
    }

    // ストリートごとの必要枚数
    const need = S.street === "FLOP" ? 3 : (S.street === "TURN" ? 1 : (S.street === "RIVER" ? 1 : 0));
    const cur = S.street === "FLOP" ? board.FLOP.length : (S.street === "TURN" ? board.TURN.length : (S.street === "RIVER" ? board.RIVER.length : 0));

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




  const onPickHero = (cs) => { setHeroCards(cs); setShowHero(false); };
  const onPickBoard = (cs) => {
    setBoard(prev => {
      const next = { ...prev };
      if (S.street === "FLOP") next.FLOP = cs.slice(0, 3);
      else if (S.street === "TURN") next.TURN = [cs[0]];
      else if (S.street === "RIVER") next.RIVER = [cs[0]];
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
      const u = JSON.parse(localStorage.getItem("pa_user") || "{}");

      const body = {
        snapshot: result.snapshot,
        evaluation: result.evaluation,
        question: q,
        user_id: u.user_id || null,
        hand_id: historyHandId || result?.evaluation?.handId || null,
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
  function saveOnly() {
    const rows = loadHist();
    rows.unshift({ id: uid(), ts: Date.now(), payload: buildPayload() });
    saveHist(rows);
    setShowPost(false);
  }
  async function saveAndAnalyze() {
    saveOnly();
    await doAnalyze();
  }
  async function analyzeNow() {
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


  // --- Mobile Layout Renderer ---
  const renderMobile = () => (
    <div className="mobile-app-root">
      {/* 1. Header Overlay */}
      <div className="mobile-header-overlay">
        <div className="logo-pill" style={{ fontSize: 14 }}>Poker Analyzer</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 簡易ログ表示ボタン */}
          <button className="btn" style={{ height: 32, padding: '0 10px', fontSize: 11 }} onClick={() => alert("LOG: " + (S ? line(S.actions, S.street) : ""))}>
            LOG
          </button>
          {/* 設定ボタン */}
          <button className="btn" style={{ height: 32, width: 32, padding: 0 }} onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </div>
      </div>

      {/* 2. Table Area (Fixed Top) */}
      <div className="mobile-table-area">
        <div
          ref={stageRef}
          className="table-stage"
          style={{ width: "100%", height: "100%", position: "relative" }}
        >
          {/* SVG Table Background */}
          <svg viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {/* テーブル外形 */}
            <ellipse cx={width / 2} cy={height / 2} rx={seatGeom.rx + 60} ry={seatGeom.ry + 60} fill="rgba(0,0,0,0.3)" />
            <ellipse cx={width / 2} cy={height / 2} rx={seatGeom.rx + 40} ry={seatGeom.ry + 40} stroke="#1f2f46" strokeWidth="4" fill="none" />
          </svg>

          {/* Seats */}
          {seatGeom.points.map((p, i) => {
            const s = S?.seats?.[i] ?? "SR";
            const isHero = s === heroSeat;
            const active = S?.actor === i;
            return (
              <div
                key={i}
                onClick={() => {
                  if (active) return;
                  const nextStack = window.prompt(`Stack for ${s}?`, S?.stacks?.[i] ?? defaultStack);
                  if (nextStack && !isNaN(nextStack)) {
                    setS((prev) => {
                      if (!prev) return prev;
                      const nx = structuredClone(prev);
                      nx.stacks[i] = Number(nextStack);
                      return nx;
                    });
                    if (s === heroSeat) setHeroStack(Number(nextStack));
                  }
                }}
                style={{
                  position: "absolute",
                  left: p.x, top: p.y,
                  transform: "translate(-50%,-50%)",
                  width: seatGeom.seatW, height: seatGeom.seatH,
                  borderRadius: 8,
                  background: active ? "#14263b" : "#0e1d2e",
                  border: active ? "2px solid #ffe08a" : "1px solid #29425c",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "#d7e7ff", zIndex: 10
                }}
              >
                <div style={{ fontWeight: 700 }}>{isHero ? "YOU" : s}</div>
                <div>{(S?.stacks?.[i] ?? 0).toFixed(1)}</div>
                {!!S?.bets?.[i] && <div style={{ color: "#ffe08a" }}>Bet:{S.bets[i]}</div>}
                {!!S?.folded?.[i] && <div style={{ color: "#555" }}>FOLD</div>}

                {/* Hero Cards (Mobile: compact display) */}
                {isHero && heroCards.length === 2 && (
                  <div style={{ marginTop: 2, display: 'flex', gap: 2 }}>{heroCards.map(c => <span key={c}>{pretty(c, "small")}</span>)}</div>
                )}
              </div>
            );
          })}

          {/* Community Cards & Pot */}
          <div style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none"
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#d7e7ff", marginBottom: 4 }}>
              POT {(S?.pot ?? 0).toFixed(1)}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[...board.FLOP, ...board.TURN, ...board.RIVER].map((c, i) => (
                <div key={i} style={{
                  width: 32, height: 42, background: "#0f1b2b", borderRadius: 4, border: "1px solid #20354d",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <PrettyBoardCard card={c} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Action Panel (Fixed Bottom) */}
      <div className="mobile-action-panel">
        {/* 直近ログ表示 */}
        <div className="mobile-log-preview">
          {S ? line(S.actions, S.street) || "No actions yet" : "Ready to start"}
        </div>

        {/* コントロール群 (Start/Reset or Actions) */}
        {!recording ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Mobile Setup Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="text-sm text-muted">
                Players
                <select value={players} onChange={e => setPlayers(Number(e.target.value))} style={{ marginTop: 4 }}>
                  {[2, 3, 4, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-sm text-muted">
                Hero Seat
                <select value={heroSeat} onChange={e => setHeroSeat(e.target.value)} style={{ marginTop: 4 }}>
                  {(S?.seats ?? ["UTG", "BTN", "SB", "BB"]).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="btn" onClick={resetAll}>リセット</button>
              <button className="btn glow btn-accent" onClick={begin}>記録開始</button>
            </div>
          </div>
        ) : (
          <ActionBar
            S={S}
            legal={legal}
            onFold={onFold}
            onCheck={onCheck}
            onCall={onCall}
            onTo={onTo}
            raiseTo={raiseTo}
            setRaiseTo={setRaiseTo}
            canAnalyze={canAnalyze}
            doAnalyze={doAnalyze}
            onUndo={onUndo}
            isMobile={true}
            onReset={resetAll}
            analyzing={analyzing}
          />
        )}
      </div>
    </div>
  );

  /* UI Renderers */

  // --- PC Layout ---
  const renderDesktop = () => (
    <>
      <header className="topbar">
        <div className="top-left-group">
          <div className="logo-pill">Poker Analyzer</div>
          <div className="top-title">ハンド記録</div>
        </div>
        <div className="top-right-group">
          {/* プラン情報 */}
          {plan && (
            <div className="plan-info">
              <div>{plan.toUpperCase()} プラン</div>
              <div>
                解析 残り{" "}
                {remainingMonth === null ? "∞" : `${remainingMonth} 回`}
              </div>
            </div>
          )}

          {auth.loggedIn ? (
            <>
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
        <section className="panel" style={{ padding: 16 }}>
          <div className="grid">
            {/* 左：セットアップ＋LOG */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="panel">
                <label>Players
                  <select
                    value={players}
                    onChange={e => setPlayers(Number(e.target.value))}
                    disabled={recording}
                    style={{ width: "100%", marginTop: 4 }}
                  >
                    {[2, 3, 4, 6, 7, 8, 9].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>

                <label style={{ marginTop: 8 }}>Hero Seat
                  <select
                    value={heroSeat}
                    onChange={e => setHeroSeat(e.target.value)}
                    disabled={recording}
                    style={{ width: "100%", marginTop: 4 }}
                  >
                    {(S?.seats ?? (players <= 2 ? ["BTN", "BB"] : ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"])).map(s =>
                      <option key={s} value={s}>{s}</option>
                    )}
                  </select>
                </label>

                <label style={{ marginTop: 8 }}>Hero Stack (BB)
                  <input
                    type="number"
                    value={heroStack ?? defaultStack}
                    onChange={e => setHeroStack(e.target.value)}
                    disabled={recording}
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </label>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn" onClick={resetAll} style={{ flex: 1 }}>
                    リセット
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {!recording
                    ? <button className="btn glow btn-accent" onClick={begin} style={{ flex: 1 }}>記録開始</button>
                    : <button className="btn glow btn-danger" onClick={endRecord} style={{ flex: 1 }}>記録終了</button>}
                </div>

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
                <div style={{ fontWeight: 700, marginBottom: 8 }}>LOG</div>
                <pre className="kbd" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {["PRE", "FLOP", "TURN", "RIVER"].map(st => `${st}: ${S ? line(S.actions, st) : ""}`).join("\n")}
                </pre>
              </div>
            </div>

            {/* 右：テーブル＋アクション */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="panel" style={{ padding: 16, overflowX: 'auto' }}>
                <div
                  ref={stageRef}
                  style={{
                    position: "relative",
                    width: "100%",
                    minWidth: "900px", // ★ PCでは最低幅を確保し、それ以下の場合はスクロールさせる
                    height: "620px",
                    margin: "0 auto",
                    padding: 0,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    borderRadius: 12,
                  }}
                >
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
                          width: seatGeom.seatW ?? 120,
                          height: seatGeom.seatH ?? 80,
                          borderRadius: seatGeom.isMobile ? 8 : 12,
                          background: active ? "#14263b" : "#0e1d2e",
                          border: active ? "2px solid #ffe08a" : "1px solid #29425c",
                          color: active ? "#ffe08a" : "#d7e7ff",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: seatGeom.isMobile ? 10 : 12,
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: seatGeom.isMobile ? 0 : 2 }}>
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
                            height: 64,
                            background: "#0f1b2b",
                            borderRadius: 6,
                            border: "1px solid #1b2a41",
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
              <div className="panel" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {recording && S && S.actor >= 0 ? (
                  <ActionBar
                    S={S}
                    legal={legal}
                    onFold={onFold}
                    onCheck={onCheck}
                    onCall={onCall}
                    onTo={onTo}
                    raiseTo={raiseTo}
                    setRaiseTo={setRaiseTo}
                    canAnalyze={canAnalyze}
                    doAnalyze={doAnalyze}
                    onUndo={onUndo}
                    isMobile={false}
                    // Desktop has explicit Reset button on left, but can add here if needed. 
                    // Not adding onReset here to keep Desktop clean as per design unless user asked.
                    analyzing={analyzing}
                  />
                ) : (

                  <div style={{ opacity: .7 }}>「記録開始」で進行。座席をクリックすることでスタックを調整できます。</div>
                )}
              </div>{/* 右カラム end */}
            </div>{/* 左+右カラムを包む grid 親 end */}
          </div>{/* page内レイアウトwrapper（存在する場合） */}
        </section>
      </main>
    </>
  );

  return (
    <>
      {isMobile ? renderMobile() : renderDesktop()}

      {/* Shared Modals */}
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
              解析を実行
            </h2>

            <div
              style={{
                fontSize: 13,
                color: "#d1d5db",
                lineHeight: 1.8,
                marginBottom: 20,
              }}
            >
              入力したハンド情報をもとに、AIによる詳細な分析を行います。<br />
              （解析結果は自動的に履歴に保存されます）
              <br />
              ショーダウンまで進んだ場合は、相手のハンドも入力することでより正確な勝率計算が可能です。
            </div>

            {/* 相手ハンド入力（任意） */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.05)"
              }}
            >
              <div style={{ fontSize: 13, color: "#d1d5db" }}>
                相手ハンド（任意）
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 14, color: villainCards.length === 2 ? "#fff" : "#6b7280", fontWeight: "bold" }}>
                  {villainCards.length === 2
                    ? villainCards.join(" ")
                    : "未入力"}
                </div>
                <button
                  className="btn btn--primary"
                  style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                  onClick={() => setShowVillain(true)}
                >
                  入力
                </button>
              </div>
            </div>

            {/* ボタン群 */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <button
                className="btn"
                style={{ width: 100 }}
                onClick={() => setShowPost(false)}
              >
                キャンセル
              </button>

              <button
                className="btn glow btn--primary"
                style={{ width: 140 }}
                onClick={() => {
                  saveAndAnalyze(); // ユーザーの意図通り「保存＋解析」を実行
                  setShowPost(false);
                }}
              >
                解析開始
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ヒーローカード選択モーダル ===== */}
      {
        showHero && (
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
        )
      }

      {/* ===== 相手ハンド入力モーダル ===== */}
      {
        showVillain && (
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
        )
      }

      {/* ===== プラン変更モーダル ===== */}
      {
        showPlanModal && (
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

              <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
                <div>・既に課金中の方は、登録済みの支払い方法でプラン変更が反映されます。</div>
                <div>・アップグレードは即時反映され、差額が日割りで請求される場合があります。</div>
                <div>・ダウングレードは次回更新日から反映されます。</div>
                <div>・解約／支払い方法変更／領収書は「設定 ＞ プラン ＞ プラン管理」から行えます。</div>
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
                      const u = JSON.parse(localStorage.getItem("pa_user") || "null");
                      if (!u || !u.user_id) {
                        alert("ログイン情報が見つかりません。再ログインしてください。");
                        return;
                      }

                      const currentPlan = String(plan || "free").toLowerCase();
                      const nextPlan = String(planForCheckout || "free").toLowerCase();

                      // 現在と同じプランを選んでいる場合は何もしない
                      if (currentPlan === nextPlan) {
                        alert("すでに現在のプランが選択されています。");
                        return;
                      }

                      // 既存課金ユーザー：アプリ内で /plan/change を叩く（Portalではない）
                      if (currentPlan !== "free") {
                        // プランの大小関係（free < basic < pro < premium）
                        const rank = { free: 0, basic: 1, pro: 2, premium: 3 };
                        const isUpgrade = (rank[nextPlan] ?? 0) > (rank[currentPlan] ?? 0);
                        const isDowngrade = (rank[nextPlan] ?? 0) < (rank[currentPlan] ?? 0);

                        const msg = isUpgrade
                          ? `【確認】プランを ${currentPlan.toUpperCase()} → ${nextPlan.toUpperCase()} に変更します。\n登録済みの支払い方法で直ちにアップグレードされ、差額が日割りで請求される場合があります。\n続行しますか？`
                          : isDowngrade
                            ? `【確認】プランを ${currentPlan.toUpperCase()} → ${nextPlan.toUpperCase()} に変更します。\nダウングレードは次回更新日から反映されます。\n続行しますか？`
                            : `【確認】プランを変更します。続行しますか？`;

                        const ok = window.confirm(msg);
                        if (!ok) return;

                        const resp = await changePlan({
                          user_id: u.user_id,
                          new_plan: nextPlan,
                        });

                        if (!resp?.ok) {
                          alert(resp?.error || "プラン変更に失敗しました。");
                          return;
                        }

                        if (resp.action === "upgrade") {
                          alert("アップグレードしました。登録済みの支払い方法で課金が発生します（差額は日割りの場合あり）。");
                        } else if (resp.action === "downgrade_scheduled") {
                          alert("ダウングレードを予約しました（次回更新日から反映されます）。");
                        } else {
                          alert("プラン変更を受け付けました。");
                        }

                        window.location.reload();
                        return;
                      }

                      // 無料 → Checkout で新規加入
                      const checkout = await createCheckoutSession({
                        user_id: u.user_id,
                        email: u.email || "",
                        plan: nextPlan,
                      });

                      if (checkout?.url) {
                        window.location.href = checkout.url;
                      } else {
                        alert("決済画面のURLを取得できませんでした。");
                      }
                    } catch (e) {
                      console.error(e);
                      alert(`処理に失敗しました: ${String(e?.message || e)}`);
                    }
                  }}
                >
                  {plan && String(plan).toLowerCase() !== "free" ? "プランを変更する" : "決済へ進む"}
                </button>
              </div>
            </div>
          </div>
        )
      }

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
        isMobile={isMobile}
      />

      {
        analyzing && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1500,
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                minWidth: 300,
                maxWidth: 360,
                padding: "32px 24px",
                borderRadius: 20,
                background: "rgba(13, 22, 35, 0.9)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                border: "1px solid rgba(100, 149, 237, 0.3)",
                textAlign: "center",
                backdropFilter: "blur(12px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#eef4ff",
                textShadow: "0 0 20px rgba(0, 212, 255, 0.5)"
              }}>
                解析中...
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                数秒〜十数秒ほどかかる場合があります。
                <br />
                そのままお待ちください。
              </div>
            </div>
          </div>
        )
      }

    </>
  );
}


