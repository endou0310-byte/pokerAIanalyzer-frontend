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
    >
      <div
        className="cardpicker-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="cardpicker-header">
          <div className="cardpicker-title">
            ボード選択 {street} / {maxPick}枚
          </div>
          <div className="cardpicker-current">
            現在の選択：
            {sel.length ? sel.map(pretty) : <span>-</span>}
          </div>
        </div>

        {/* カードグリッド：4行×13列（カードのみ） */}
        <div className="cardpicker-grid">
          {SUITS.map((suit) => (
            <div className="cardpicker-row" key={suit}>
              {RANKS.map((rank) => {
                const code = rank + suit;
                const disabled =
                  usedSet.has(code) || (!sel.includes(code) && sel.length >= maxPick);
                const active = sel.includes(code);
                // color logic is handled by CSS or helper now, but we'll keep inline color for suit icon if needed or move to logic
                // Actually CardPickerModal relies on .s-red class.
                // Let's mirror CardPickerModal's structure closely.
                const isRed = suit === 'h' || suit === 'd';

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggle(code)}
                    disabled={disabled}
                    className={`cardpicker-card ${active ? "cardpicker-card--active" : ""} ${isRed ? "s-red" : "s-black"}`}
                    title={code}
                  >
                    <span className="cardpicker-rank">{rank}</span>
                    <span className="cardpicker-suit" data-suit={suit}>{suitSym[suit]}</span>
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
