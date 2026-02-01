import React, { useMemo, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import html2canvas from "html2canvas";
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

  // Share functionality
  const contentRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Generate screenshot and store it
  const generateScreenshot = async () => {
    if (!contentRef.current) return null;

    try {
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#0b1524',
        scale: 2,
        logging: false
      });

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const url = URL.createObjectURL(blob);
          resolve({ blob, url });
        }, 'image/png');
      });
    } catch (err) {
      console.error('Screenshot failed:', err);
      return null;
    }
  };

  // Handle share - always show custom SNS menu
  const handleShare = async () => {
    setIsSharing(true);

    const screenshot = await generateScreenshot();
    if (!screenshot) {
      alert('画像の生成に失敗しました');
      setIsSharing(false);
      return;
    }

    const { blob, url } = screenshot;
    setShareImageUrl(url);

    // Always show custom SNS menu (not using Web Share API)
    setShowShareMenu(true);
    setIsSharing(false);
  };

  // Format card with suit symbols
  const formatCard = (card) => {
    const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };
    return card.rank + suitSymbols[card.suit];
  };

  // Generate share text based on hand data
  const generateShareText = () => {
    if (!snapshot) {
      return {
        text: 'PokerAnalyzerでハンド解析！\nAIによる戦略分析を体験 🎯\n\n',
        url: 'https://pokeranalyzer.jp',
        hashtags: 'PokerAnalyzer,ポーカー,GTO'
      };
    }

    const parts = [];

    // Hand - with suit symbols
    if (snapshot.heroHand && snapshot.heroHand.length === 2) {
      const handStr = snapshot.heroHand.map(c => formatCard(c)).join(' ');
      parts.push(`🃏 Hand: ${handStr}`);
    }

    // Position
    if (snapshot.heroPosition) {
      parts.push(`📍 Position: ${snapshot.heroPosition}`);
    }

    // Board - with suit symbols
    if (snapshot.board && snapshot.board.length > 0) {
      const boardStr = snapshot.board.map(c => formatCard(c)).join(' ');
      parts.push(`🎯 Board: ${boardStr}`);
    }

    // AI Analysis Summary
    if (initialMd) {
      // Improved extraction: Skip headers and find first meaningful paragraph
      const lines = initialMd.split('\n');
      let summaryStr = "";

      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines, headers (#), and "Part X:" titles
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('Part ')) {
          continue;
        }
        // Found content
        summaryStr = trimmed.replace(/[#*`]/g, '');
        break;
      }

      if (!summaryStr) {
        summaryStr = initialMd.replace(/[#*`]/g, '').replace(/\n+/g, ' ').trim();
      }

      if (summaryStr.length > 80) {
        summaryStr = summaryStr.substring(0, 80) + '...';
      }

      if (summaryStr && summaryStr !== "解析結果が見つかりません。") {
        parts.push(`\n🤖 AI: ${summaryStr}`);
      }
    }

    const text = parts.length > 0
      ? `PokerAnalyzerでハンド解析！\n\n${parts.join('\n')}\n`
      : 'PokerAnalyzerでハンド解析！\nAIによる戦略分析を体験 🎯\n\n';

    // Generate URL based on handId
    const url = handId
      ? `https://pokeranalyzer.jp/hand/${handId}`
      : 'https://pokeranalyzer.jp';

    return {
      text,
      url,
      hashtags: 'PokerAnalyzer,ポーカー'
    };
  };

  // Share to specific SNS
  // Share to specific SNS
  const shareToSNS = (platform) => {
    // Generate share content (always available from snapshot)
    const { text, url, hashtags } = generateShareText();

    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`;
        break;
      case 'line':
        shareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text + url)}`;
        break;
      case 'discord':
        // Discord: Copy text -> Open App
        navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
          alert('共有用テキストをコピーしました！\nDiscordアプリが開きますので、貼り付けて投稿してください。');
          // Try to open Discord app
          window.open('discord://', '_blank');
        });
        return;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      default:
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

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
          ref={contentRef}
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
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
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {/* SNS Share Menu - YouTube Style */}
          {showShareMenu && (
            <div style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              top: 0, // Cover entire screen
              background: "rgba(0,0,0,0.6)", // Dim background
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 99999 // Highest priority
            }} onClick={() => setShowShareMenu(false)}>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(500px, 90vw)",
                  background: "#212121", // YouTube Dark bg color
                  color: "#fff",
                  borderRadius: 16,
                  padding: "20px 24px",
                  boxShadow: "0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  position: "relative"
                }}
              >
                {/* Header */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ fontSize: 18, fontWeight: 500 }}>共有</div>
                  <button
                    onClick={() => setShowShareMenu(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#aaa",
                      fontSize: 24,
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Icons Row */}
                <div style={{
                  display: "flex",
                  gap: 24,
                  overflowX: "auto",
                  paddingBottom: 8,
                  justifyContent: "flex-start" // Left align to allow scroll if needed
                }}>
                  {/* Twitter / X */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 60 }}>
                    <button
                      onClick={() => shareToSNS('twitter')}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "#000",
                        border: "1px solid #333",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                        overflow: "hidden"
                      }}
                    >
                      <img src="/img/logo.svg" alt="X" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
                    </button>
                    <span style={{ fontSize: 12, color: "#aaa" }}>X</span>
                  </div>

                  {/* LINE */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 60 }}>
                    <button
                      onClick={() => shareToSNS('line')}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "#fff", // White bg for colored icon
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                        overflow: "hidden"
                      }}
                    >
                      <img src="/img/icons8-line-96.svg" alt="LINE" style={{ width: "60px", height: "60px", objectFit: "cover" }} />
                    </button>
                    <span style={{ fontSize: 12, color: "#aaa" }}>LINE</span>
                  </div>

                  {/* Discord */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 60 }}>
                    <button
                      onClick={() => shareToSNS('discord')}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "#fff", // White bg for colored icon
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                        overflow: "hidden"
                      }}
                    >
                      <img src="/img/icons8-discordの新しいロゴ-96.svg" alt="Discord" style={{ width: "60px", height: "60px", objectFit: "cover" }} />
                    </button>
                    <span style={{ fontSize: 12, color: "#aaa" }}>Discord</span>
                  </div>

                  {/* Facebook */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 60 }}>
                    <button
                      onClick={() => shareToSNS('facebook')}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "#fff", // White bg for colored icon
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                        overflow: "hidden"
                      }}
                    >
                      <img src="/img/2021_Facebook_icon.svg" alt="Facebook" style={{ width: "60px", height: "60px", objectFit: "cover" }} />
                    </button>
                    <span style={{ fontSize: 12, color: "#aaa" }}>Facebook</span>
                  </div>
                </div>

                {/* URL Copy Section */}
                <div style={{
                  background: "#121212",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: "8px 8px 8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12
                }}>
                  <div style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#3ea6ff",
                    fontSize: 14
                  }}>
                    {generateShareText().url}
                  </div>
                  <button
                    onClick={() => {
                      const url = generateShareText().url;
                      navigator.clipboard.writeText(url);
                      alert("URLをコピーしました！");
                    }}
                    style={{
                      background: "#3ea6ff",
                      color: "#0f0f0f",
                      border: "none",
                      borderRadius: 18,
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    コピー
                  </button>
                </div>

              </div>
            </div>
          )}

          <button
            className="btn"
            onClick={handleShare}
            disabled={isSharing}
            style={{ fontSize: 13, padding: "8px 16px" }}
          >
            {isSharing ? "生成中..." : "📤 SNSでシェア"}
          </button>
          <button className="btn" onClick={() => onClose?.()}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
