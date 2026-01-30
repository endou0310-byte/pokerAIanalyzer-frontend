import React, { useMemo, useState, useEffect } from "react";

const suitSym = { h: "♥", d: "♦", s: "♠", c: "♣" };

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = ["h", "d", "s", "c"]; // 行 = スート, 列 = ランク

const asLabelInline = (c) => {
  if (!c || c.length < 2) return "";
  const r = c[0].toUpperCase();
  const s = c[1].toLowerCase();
  const color = s === "h" || s === "d" ? "#ff6b81" : "#9ecbff";
  return (
    <span>
      {r}
      <span style={{ marginLeft: 4, color }}>{suitSym[s]}</span>
    </span>
  );
};

export default function CardPickerModal({
  open = false,
  title = "カード選択",
  initialCards = [],
  exclude = [],
  onConfirm,
  onCancel,
}) {
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    setPicked((initialCards || []).slice(0, 2));
  }, [initialCards, open]);

  const disabledSet = useMemo(
    () => new Set((exclude || []).map(String)),
    [exclude]
  );

  const toggle = (code) => {
    if (disabledSet.has(code)) return;
    setPicked((cur) => {
      const i = cur.indexOf(code);
      if (i >= 0) {
        const next = cur.slice();
        next.splice(i, 1);
        return next;
      }
      // Keep first card when adding second (limit to 2 cards total)
      // Use spread to ensure new array reference for React
      return [...cur.slice(0, 1), code];
    });
  };

  if (!open) return null;

  return (
    <div
      className="cardpicker-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={() => onCancel?.()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px'
      }}
    >
      <div
        className="cardpicker-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(13, 22, 35, 0.95)',
          borderRadius: '16px',
          border: '1px solid rgba(100, 149, 237, 0.2)',
          maxWidth: '95vw',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* ヘッダー */}
        <div className="cardpicker-header" style={{
          padding: '16px',
          borderBottom: '1px solid rgba(100, 149, 237, 0.15)'
        }}>
          <div className="cardpicker-title">{title}</div>
          <div className="cardpicker-current">
            現在の選択：
            {picked.length ? (
              picked.map((c) => (
                <span key={c} className="cardpicker-current-chip">
                  {asLabelInline(c)}
                </span>
              ))
            ) : (
              <span>-</span>
            )}
          </div>
        </div>

        {/* 4行×13列のカードグリッド（カードのみ） */}
        <div className="cardpicker-grid" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '8px'
        }}>
          {SUITS.map((suit) => (
            <div className="cardpicker-row" key={suit} style={{
              display: 'flex',
              gap: '4px',
              flexWrap: 'nowrap',
              justifyContent: 'center'
            }}>
              {RANKS.map((rank) => {
                const code = rank + suit;
                const active = picked.includes(code);
                const locked = disabledSet.has(code);
                const suitColor = (suit === 'h' || suit === 'd') ? '#ff6b81' : '#9ecbff';

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggle(code)}
                    disabled={locked}
                    title={code}
                    style={{
                      width: '23px',
                      height: '32px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: active ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: active ? '2px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      opacity: locked ? 0.3 : 1,
                      transition: 'all 0.2s',
                      padding: '2px'
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>{rank}</span>
                    <span style={{ fontSize: '14px', color: suitColor }}>
                      {suitSym[suit]}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="cardpicker-footer" style={{
          padding: '16px',
          borderTop: '1px solid rgba(100, 149, 237, 0.15)',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            className="btn"
            onClick={() => onConfirm?.(picked)}
            disabled={picked.length !== 2}
          >
            決定
          </button>
          <button className="btn" onClick={() => onCancel?.()}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
