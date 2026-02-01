import React from "react";

/**
 * NewsModal - 緊急お知らせのポップアップモーダル
 * 
 * @param {object} news - 表示するニュースオブジェクト
 * @param {function} onClose - モーダルを閉じる関数
 */
function NewsModal({ news, onClose }) {
    if (!news) return null;

    const priorityColors = {
        high: "#ff7b7b",
        medium: "#fbbf24",
        low: "#60a5fa"
    };

    const priorityBg = {
        high: "rgba(255, 123, 123, 0.1)",
        medium: "rgba(251, 191, 36, 0.1)",
        low: "rgba(96, 165, 250, 0.1)"
    };

    const color = priorityColors[news.priority] || priorityColors.medium;
    const bg = priorityBg[news.priority] || priorityBg.medium;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3000,
                padding: 24
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "min(500px, 100%)",
                    background: "#0f1723",
                    border: `1px solid ${color}40`,
                    borderRadius: 20,
                    padding: 32,
                    boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px ${color}20`,
                    position: "relative"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Priority badge */}
                {news.priority === "high" && (
                    <div style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: color,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 16px",
                        borderRadius: 99,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        boxShadow: `0 4px 12px ${color}60`
                    }}>
                        重要
                    </div>
                )}

                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#cbd5e1",
                        fontSize: 18,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    }}
                >
                    ✕
                </button>

                {/* Content */}
                <div style={{ marginTop: news.priority === "high" ? 12 : 0 }}>
                    <div style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#eef4ff",
                        marginBottom: 16,
                        paddingRight: 32
                    }}>
                        {news.title}
                    </div>

                    <div style={{
                        fontSize: 14,
                        color: "#cbd5e1",
                        lineHeight: 1.7,
                        whiteSpace: "pre-line",
                        background: bg,
                        padding: 20,
                        borderRadius: 12,
                        border: `1px solid ${color}20`
                    }}>
                        {news.message}
                    </div>

                    {/* OK Button */}
                    <button
                        onClick={onClose}
                        className="btn"
                        style={{
                            width: "100%",
                            marginTop: 20,
                            background: color,
                            border: "none",
                            fontSize: 14,
                            fontWeight: 600,
                            padding: 12
                        }}
                    >
                        確認しました
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NewsModal;
