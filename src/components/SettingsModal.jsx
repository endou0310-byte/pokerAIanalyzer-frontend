import React, { useState, useEffect } from "react";
import { fetchPlan, createPortalSession } from "../api.js";
import InformationList from "./InformationList.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function SettingsModal({ open, onClose, userInfo, plan, remainingMonth, defaultStack, setDefaultStack, defaultPlayers, setDefaultPlayers, onLogout, isMobile, isNativeBillingAvailable }) {
  // ...

  // リンク先
  const PRIVACY_URL = "privacy.html";
  const TERMS_URL = "terms.html";
  const SUPPORT_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdCmr7yabVudrcoQ6VtIBnTua3r8GffCvTZgSArG4bMbNCQ_w/viewform?usp=dialog";

  const [activeTab, setActiveTab] = useState("account");

  // 入力フォーム用ローカルステート
  const [localStack, setLocalStack] = useState(defaultStack);
  const [localPlayers, setLocalPlayers] = useState(defaultPlayers);
  useEffect(() => {
    setLocalStack(defaultStack);
  }, [defaultStack]);
  useEffect(() => {
    setLocalPlayers(defaultPlayers);
  }, [defaultPlayers]);

  if (!open) return null;

  const resolveUserId = () => {
    if (userInfo?.user_id) return userInfo.user_id;
    try {
      const u = JSON.parse(localStorage.getItem("pa_user") || "null");
      return u?.user_id || null;
    } catch { return null; }
  };

  const handleOpenPortal = async () => {
    const user_id = resolveUserId();
    if (!user_id) return alert("ユーザー情報が見つかりません。再ログインしてください。");
    try {
      const resp = await createPortalSession({ user_id });
      if (resp?.ok && resp?.url) window.location.href = resp.url;
      else alert("管理画面のURLを取得できませんでした。");
    } catch (e) {
      console.error(e);
      alert(`管理画面を開けませんでした: ${String(e?.message || e)}`);
    }
  };

  const tabs = [
    { id: "account", label: "アカウント" },
    { id: "information", label: "お知らせ" },
    { id: "input", label: "入力設定" },
    { id: "analysis", label: "解析設定" },
    { id: "plan", label: "プラン" },
    { id: "support", label: "サポート" },
    { id: "data", label: "データ管理" },
  ];

  // Mobile Layout: Tabs on TOP (Horizontal Scroll), Content Below
  // Desktop Layout: Tabs on LEFT (Vertical), Content Right
  const containerStyle = isMobile ? {
    flexDirection: "column",
    gap: 0
  } : {
    flexDirection: "row",
    gap: 24
  };

  const asideStyle = isMobile ? {
    display: "flex",
    overflowX: "auto",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    padding: "0 4px",
    marginBottom: 12,
    flexShrink: 0,
    // Scroll hint
    maskImage: "linear-gradient(to right, black 85%, transparent 100%)",
    WebkitMaskImage: "linear-gradient(to right, black 85%, transparent 100%)",
  } : {
    width: 180,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid rgba(255,255,255,0.05)",
    paddingRight: 16
  };

  const mainStyle = {
    flex: 1,
    padding: isMobile ? "0 4px 20px" : 16,
    overflowY: "auto",
    maxHeight: isMobile ? "60vh" : "auto"
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 800, maxWidth: "94vw",
          height: "auto", // Auto height to fit content
          maxHeight: "85vh", // Limit max height
          background: "#0f1723",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>設定</h2>
          <button className="btn" onClick={onClose} style={{ width: 32, height: 32, padding: 0 }}>✕</button>
        </div>

        <div style={{ display: "flex", ...containerStyle, flex: 1, overflow: "hidden" }}>
          {/* Tabs */}
          <aside style={asideStyle}>
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={isMobile ? {
                  // Mobile Tab Style
                  padding: "10px 16px",
                  background: "transparent",
                  color: activeTab === id ? "#fff" : "#94a3b8",
                  borderBottom: activeTab === id ? "2px solid #6366f1" : "2px solid transparent",
                  whiteSpace: "nowrap",
                  border: "none", // Reset default border
                  flexShrink: 0
                } : {
                  // Desktop Tab Style
                  width: "100%", padding: "10px 12px", textAlign: "left", borderRadius: 10,
                  border: "1px solid transparent",
                  background: activeTab === id ? "rgba(99,102,241,.15)" : "transparent",
                  color: id === "data" ? "#fca5a5" : (activeTab === id ? "#fff" : "#94a3b8"),
                  marginBottom: 6,
                  fontSize: 14
                }}
              >
                {label}
              </button>
            ))}
          </aside>

          {/* Content */}
          <main style={mainStyle}>
            {activeTab === "account" && (
              <>
                <h3 style={{ marginTop: 0 }}>アカウント</h3>
                <div style={{ color: "#cbd5e1", lineHeight: 1.9, fontSize: 13 }}>
                  <div>メール：{userInfo?.email || "-"}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>ID: {userInfo?.user_id || "-"}</div>
                  <div>プラン：{plan ? plan.toUpperCase() : "-"}</div>
                  <div>今月の残り解析：{remainingMonth === null ? "∞" : `${remainingMonth} 回`}</div>
                </div>
                {typeof onLogout === "function" && (
                  <button onClick={onLogout} className="btn" style={{ marginTop: 16, fontSize: 12 }}>ログアウト</button>
                )}
              </>
            )}

            {activeTab === "information" && (
              <>
                <h3 style={{ marginTop: 0 }}>お知らせ</h3>
                <InformationList />
              </>
            )}

            {activeTab === "input" && (
              <>
                <h3 style={{ marginTop: 0 }}>入力設定</h3>

                {/* Default Stack */}
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6 }}>初期スタック (BB)</label>
                <input
                  type="number" value={localStack} onChange={(e) => setLocalStack(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#fff", marginBottom: 16 }}
                />

                {/* Default Players */}
                <label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 6 }}>初期プレイヤー人数 (2-9人)</label>
                <select
                  value={localPlayers}
                  onChange={(e) => setLocalPlayers(Number(e.target.value))}
                  style={{ width: "100%", padding: 10, borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#fff" }}
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                    <option key={n} value={n}>{n}人</option>
                  ))}
                </select>

                <div style={{ fontSize: 11, color: "#9ca3af", margin: "16px 0 16px" }}>
                  新規ハンド作成時やリセット時のデフォルト値です。
                </div>

                <button
                  className="btn btn--primary"
                  disabled={Number(localStack) === Number(defaultStack) && Number(localPlayers) === Number(defaultPlayers)}
                  onClick={async () => {
                    const uid = resolveUserId();
                    if (!uid) return alert("ユーザーIDが見つかりません");
                    try {
                      await fetch(`${API_BASE}/auth/settings`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          user_id: uid,
                          default_stack: Number(localStack),
                          default_players: Number(localPlayers)
                        })
                      });

                      setDefaultStack(Number(localStack));
                      setDefaultPlayers(Number(localPlayers));

                      const u = JSON.parse(localStorage.getItem("pa_user") || "null");
                      if (u) {
                        u.default_stack = Number(localStack);
                        u.default_players = Number(localPlayers);
                        localStorage.setItem("pa_user", JSON.stringify(u));
                      }

                      alert("設定を保存しました");
                    } catch (e) { alert("エラー: " + e.message); }
                  }}
                >
                  保存
                </button>
              </>
            )}

            {activeTab === "analysis" && (
              /* ... Analysis content ... */
              <>
                <h3 style={{ marginTop: 0 }}>解析設定</h3>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>現在は設定項目はありません。</p>
              </>
            )}

            {activeTab === "plan" && (
              <>
                <h3 style={{ marginTop: 0 }}>プラン</h3>
                <div style={{ color: "#cbd5e1", lineHeight: 1.9, fontSize: 13, marginBottom: 12 }}>
                  <div>現在：{plan ? plan.toUpperCase() : "-"}</div>
                </div>
                {isNativeBillingAvailable ? (
                  <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
                    アプリ内決済をご利用中の場合、<br />
                    定期購入の管理（解約・更新など）は<br />
                    <span style={{ color: "#efefef", fontWeight: "bold" }}>Google Play ストア</span> の「定期購入」から行ってください。
                  </div>
                ) : (
                  <a href="#" onClick={(e) => { e.preventDefault(); handleOpenPortal(); }} style={{ color: "#6366f1" }}>プラン管理画面へ</a>
                )}
              </>
            )}

            {activeTab === "support" && (
              <>
                <h3 style={{ marginTop: 0 }}>サポート</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
                  <a href={SUPPORT_FORM_URL} target="_blank" style={{ color: "#6366f1" }}>お問い合わせ</a>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={PRIVACY_URL} target="_blank" style={{ color: "#94a3b8" }}>プライバシー</a>
                    <a href={TERMS_URL} target="_blank" style={{ color: "#94a3b8" }}>利用規約</a>
                  </div>
                </div>
              </>
            )}

            {activeTab === "data" && (
              <>
                <h3 style={{ marginTop: 0, color: "#f87171" }}>データ管理</h3>
                <p style={{ fontSize: 12, color: "#f87171", marginBottom: 16 }}>
                  注意：この操作は元に戻せません。すべての解析履歴が完全に削除されます。
                </p>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (!window.confirm("本当にすべての履歴を削除しますか？\nこの操作は取り消せません。")) return;

                    const uid = resolveUserId();
                    if (!uid) return alert("ユーザーIDが見つかりません");

                    try {
                      // 念のためもう一度確認
                      if (!window.confirm("最終確認：全データを削除してよろしいですか？")) return;

                      const res = await fetch(`${API_BASE}/history/delete_all`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: uid })
                      });
                      const json = await res.json();
                      if (json.ok) {
                        alert("履歴を全て削除しました。");
                        window.location.reload();
                      } else {
                        alert("削除に失敗しました: " + (json.error || "Unknown"));
                      }
                    } catch (e) {
                      alert("エラーが発生しました: " + e.message);
                    }
                  }}
                >
                  履歴をすべて削除する
                </button>
              </>
            )}
          </main>
        </div>

        {/* Version Indicator */}
        <div style={{ marginTop: 16, textAlign: "right", fontSize: 11, color: "#4b5563", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          Version: 1.0.2
        </div>
      </div>
    </div>
  );
}
