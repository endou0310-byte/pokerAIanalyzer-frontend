import React, { useMemo, useState, useEffect } from "react";

const suitSym = { h: "♥", d: "♦", s: "♠", c: "♣" };
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = ["h", "d", "s", "c"]; // 行 = スート, 列 = ランク

// 内部表現を "Ah" "Td" のように正規化
const norm = (c) =>
  typeof c === "string" && c.length >= 2
    ? c[0].toUpperCase() + c[1].toLowerCase()
    : c;

export default function BoardPickerModal({
  open,
  street = "FLOP",
  used = [],
  initial = [],
  onClose,
  onPick,
}) {
  if (!open) return null;

  const maxPick = street === "FLOP" ? 3 : 1;

  const usedSet = useMemo(
    () => new Set((used || []).map(norm)),
    [used]
  );

  const [sel, setSel] = useState(
    (initial || []).slice(0, maxPick).map(norm)
  );

  useEffect(() => {
    setSel((initial || []).slice(0, maxPick).map(norm));
  }, [open, street, maxPick, initial]);

  const toggle = (code) => {
    if (usedSet.has(code)) return;
    setSel((cur) => {
      const has = cur.includes(code);
      if (has) return cur.filter((x) => x !== code);
      if (cur.length >= maxPick) return cur;
      return [...cur, code];
    });
  };

  const canDecide = sel.length === maxPick;

  const pretty = (c) => {
    const card = norm(c);
    const r = card[0];
    const s = card[1].toLowerCase();
    const color = s === "h" || s === "d" ? "#ff6b81" : "#9ecbff";
    return (
      <span key={card} style={{ marginRight: 8 }}>
        {r}
        <span style={{ marginLeft: 2, color }}>{suitSym[s]}</span>
      </span>
    );
  };

  return (
    <div
      className="cardpicker-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
          <div className="cardpicker-title">
            ボード選択 {street} / {maxPick}枚
          </div>
          <div className="cardpicker-current">
            現在の選択：
            {sel.length ? sel.map(pretty) : <span>-</span>}
          </div>
        </div>

        {/* カードグリッド：4行×13列（カードのみ） */}
        <div className="cardpicker-grid" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '60vh',
          overflowY: 'auto',
          padding: '8px'
        }}>
          {SUITS.map((suit) => (
            <div className="cardpicker-row" key={suit} style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {RANKS.map((rank) => {
                const code = rank + suit;
                const disabled =
                  usedSet.has(code) || (!sel.includes(code) && sel.length >= maxPick);
                const active = sel.includes(code);
                const suitColor = (suit === 'h' || suit === 'd') ? '#ff6b81' : '#9ecbff';

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggle(code)}
                    disabled={disabled}
                    title={code}
                    style={{
                      width: '50px',
                      height: '70px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: active ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: active ? '2px solid #00d4ff' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.3 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{rank}</span>
                    <span style={{ fontSize: '24px', color: suitColor }}>
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
            onClick={() => canDecide && onPick(sel)}
            disabled={!canDecide}
          >
            決定
          </button>
          <button className="btn" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
