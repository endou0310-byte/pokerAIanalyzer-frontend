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
    >
      <div
        className="cardpicker-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="cardpicker-header">
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
        <div className="cardpicker-grid">
          {SUITS.map((suit) => (
            <div className="cardpicker-row" key={suit}>
              {RANKS.map((rank) => {
                const code = rank + suit;
                const active = picked.includes(code);
                const locked = disabledSet.has(code);
                let cls = "cardpicker-card";
                if (active) cls += " cardpicker-card--active";
                if (locked) cls += " cardpicker-card--disabled";
                return (
                  <button
                    key={code}
                    type="button"
                    className={cls}
                    onClick={() => toggle(code)}
                    disabled={locked}
                    title={code}
                  >
                    <span className="cardpicker-rank">{rank}</span>
                    <span
                      className="cardpicker-suit"
                      data-suit={suit}
                    >
                      {suitSym[suit]}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="cardpicker-footer">
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
