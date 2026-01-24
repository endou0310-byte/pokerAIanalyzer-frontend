import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { followupQuestion, saveHistory, updateHistoryConversation } from "../api";

/**
 * 解析結果 + 追い質問モーダル
 *
 * props:
 * - open: boolean
 * - onClose: () => void
 * - result: { evaluation, snapshot, handId, ... }
 * - followupsPerHand: number | null   // null の場合は無制限
 * - followupsUsed: number             // これまでに使用した回数
 * - onFollowupUsage: (usage) => void  // { used_for_this_hand, followups_per_hand }
 */
export default function ResultModal({
  open,
  onClose,
  result,
  followupsPerHand,
  followupsUsed,
  onFollowupUsage,
}) {
  if (!open || !result) return null;

  // result には App.jsx から evaluation / snapshot / handId を含む想定
  const evaluation = result?.evaluation || {};
  const snapshot = result?.snapshot || null;
  // ★ handId は親から渡されたものだけを使う
  const handId = result?.handId || evaluation?.handId || null;
  const initialMd =
    evaluation?.markdown ||
    evaluation?.text ||
    evaluation?.message ||
    result?.markdown ||
    "解析結果が見つかりません。";

  // Q&A ログ
  const [conversation, setConversation] = useState([]);

  React.useEffect(() => {
    // 履歴から開いた場合 result.conversation が入っているので初期化する
    if (Array.isArray(result?.conversation)) {
      // ★ すでにモーダル内で会話が進んでいる場合は上書きしない
      setConversation((prev) =>
        prev.length === 0 ? result.conversation : prev
      );
    }
  }, [result]);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // 追い質問の残り回数（制限なしなら null）
  const remainingFU =
    followupsPerHand == null
      ? null
      : Math.max(0, followupsPerHand - (followupsUsed || 0));

  const noMoreFU = remainingFU !== null && remainingFU <= 0;

  // 画面表示用：初回 markdown + Q&A を結合
  const displayMarkdown = useMemo(() => {
    const qna = conversation
      .map((m) =>
        m.role === "user"
          ? `\n\n**Q:** ${m.message}`
          : `\n\n**A:** ${m.message}`
      )
      .join("");
    return `${initialMd}${qna}`;
  }, [initialMd, conversation]);


  const onSend = async () => {
    const text = (q || "").trim();
    if (!text || loading) return;

    // ★ handId がないと /followup が 400 になるのでガード
    if (!handId) {
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          message:
            "（エラー）handId が設定されていません。もう一度解析からやり直してください。",
          ts: Date.now(),
        },
      ]);
      return;
    }

    setLoading(true);
    const t1 = Date.now();
    setConversation((prev) => [
      ...prev,
      { role: "user", message: text, ts: t1 },
    ]);
    setQ("");

    try {
      // ログイン情報から user_id を取得
      const u = (() => {
        try {
          return JSON.parse(localStorage.getItem("pa_user") || "{}");
        } catch {
          return {};
        }
      })();

      const res = await followupQuestion({
        snapshot,
        evaluation,
        question: text,
        history: conversation, // これまでのQ&A（user/assistant）
        user_id: u.user_id || null,
        hand_id: handId,       // ★ server 側で hand_id を見るのでこちらに統一
      });

      // デバッグ用ログ
      console.debug("[/followup] response:", res);


      // サーバの実レスポンス形を踏まえ、優先的に message を拾う
      let answer =
        // まずは result 配下
        res?.result?.markdown ??
        res?.result?.text ??
        res?.result?.answer ??
        res?.result?.content ??
        res?.result?.message ??
        // 直下
        res?.markdown ??
        res?.text ??
        res?.answer ??
        res?.content ??
        res?.message ??
        // data 配下や output/choices など
        res?.data?.markdown ??
        res?.data?.text ??
        res?.data?.answer ??
        res?.output?.text ??
        res?.choices?.[0]?.message?.content ??
        // 文字列そのものが返るケース
        (typeof res === "string" ? res : null);

      // なお取れない場合だけ、生JSONを表示（デバッグ用）
      if (!answer || (typeof answer === "string" && !answer.trim())) {
        const raw = (() => {
          try {
            return JSON.stringify(res, null, 2);
          } catch {
            return String(res);
          }
        })();
        answer =
          "（回答本文が見つかりません。サーバの戻り値を表示します）\n\n" +
          "```json\n" +
          raw +
          "\n```";
      }

      const t2 = Date.now();
      const nextConv = [
        ...conversation,
        { role: "user", message: text, ts: t1 },
        { role: "assistant", message: answer, ts: t2 },
      ];

      // usage を親（App.jsx）に伝える
      if (res && res.followup_usage && typeof onFollowupUsage === "function") {
        try {
          onFollowupUsage(res.followup_usage);
        } catch (err) {
          console.error("onFollowupUsage error:", err);
        }
      }

      setConversation((prev) => [
        ...prev,
        { role: "assistant", message: answer, ts: t2 },
      ]);

      // ★★★ 会話ログを DB に保存（逐次 UPDATE）
      try {
        await updateHistoryConversation(u.user_id, handId, nextConv);
      } catch (err) {
        console.error("DB更新エラー", err);
      }

      // モーダルと同じ内容を履歴へ保存（サーバ側は upsert 推奨）
      if (import.meta.env.VITE_HISTORY_SAVE === "1" && u.user_id) {
        await saveHistory({
          user_id: u.user_id,                    // ★ 追加
          handId,                                // hand_id / handId どちらでも server 側で吸収
          snapshot,
          evaluation,
          conversation: nextConv,
          markdown: `${initialMd}\n\n**Q:** ${text}\n\n**A:** ${answer}`,
        }).catch(() => { });
      }

    } catch (e) {
      setConversation((prev) => [
        ...prev,
        {
          role: "assistant",
          message: `（送信エラー）${String(e.message || e)}`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "min(960px, 92vw)",
          maxHeight: "84vh",
          background: "rgba(13, 22, 35, 0.95)", // Glass base dark
          border: "1px solid rgba(100, 149, 237, 0.2)",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 本文 */}
        <div
          className="markdown-result"
          style={{
            overflow: "auto",
            paddingRight: 8,
            flex: 1, // Fill available space
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayMarkdown}
          </ReactMarkdown>
        </div>

        {/* 追い質問入力 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {remainingFU !== null && (
            <div style={{ fontSize: 12, color: "#9ca3af", minWidth: 110 }}>
              追い質問 残り {remainingFU} 回
            </div>
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              noMoreFU ? "これ以上質問できません" : "ここに追い質問を入力"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
            disabled={noMoreFU}
            style={{
              flex: 1,
              background: "#0b1524",
              border: "1px solid #24364a",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#e8f1ff",
            }}
          />
          <button
            className="btn btn--primary"
            onClick={onSend}
            disabled={loading || !q.trim() || noMoreFU}
          >
            {loading ? "送信中..." : "送信"}
          </button>
          <button className="btn" onClick={() => onClose?.()}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
