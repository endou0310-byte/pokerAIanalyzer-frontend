import React from "react";
import * as E from "../lib/engine.js";

function fmtBB(n) {
    const x = Number(n ?? 0);
    const s = x.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return `${s}BB`;
}

export default function ActionBar({
    S,
    legal,
    onFold,
    onCheck,
    onCall,
    onTo,
    raiseTo,
    setRaiseTo,
    canAnalyze,
    doAnalyze,
    onUndo,        // New: Undo handler
    isMobile,      // New: For conditional layout or reset button
    onReset,       // New: Reset handler (for mobile mainly)
    analyzing
}) {
    if (!S || S.actor < 0) return null;

    // Compute derived values
    const raisePresets = S ? E.presets(S) : [];
    const showBetPct = !!S && S.street !== "PRE" && S.currentBet === 0;

    // Handler for % bets
    function handleBetPct(pct) {
        if (!S) return;
        const sumBets = (S.bets || []).reduce((a, b) => a + b, 0);
        const basePot = (S.pot || 0) + sumBets;
        const want = +(basePot * pct).toFixed(2);
        const already = S.committed[S.actor] ?? 0;
        const to = +(already + want).toFixed(2);
        onTo(to);
    }

    // Compute Slider ranges
    const inc = Math.max(1.0, S.lastRaiseSize || 1.0);
    const base = S.lastBetTo || S.currentBet || 0;
    const minTo = S.currentBet === 0
        ? (S.street === "PRE" ? 2 : 1)
        : +(base + inc).toFixed(2);
    const maxTo = +((S.committed?.[S.actor] || 0) + (S.stacks?.[S.actor] || 0)).toFixed(2);

    // Input value logic
    const value = Number.isFinite(Number(raiseTo)) ? Number(raiseTo) : minTo;
    // Handle slider pct for visuals
    const range = Math.max(1e-9, maxTo - minTo);
    const pct = ((value - minTo) / range) * 100;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>

            {/* Action Buttons Row */}
            <div className="action-bar" style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-danger" disabled={!legal.fold} onClick={onFold}>
                    Fold
                </button>
                <button className="btn" disabled={!legal.check} onClick={onCheck}>
                    Check
                </button>
                <button className="btn" disabled={!legal.call} onClick={onCall}>
                    Call
                </button>

                {/* Undo Button */}
                {onUndo && (
                    <button className="btn" style={{ padding: "0 12px", background: "#334" }} onClick={onUndo} title="Undo last action">
                        ↩
                    </button>
                )}

                {/* Mobile Reset Button (If isMobile) */}
                {isMobile && onReset && (
                    <button className="btn" style={{ padding: "0 12px", background: "#4a151b", color: "#fca5a5" }} onClick={onReset} title="Reset Hand">
                        ✕
                    </button>
                )}
            </div>

            {/* Raise Presets & Slider Area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: isMobile ? 8 : 12, minHeight: 0 }}>
                {/* Raise Presets (Chips) - Scrollable on Mobile */}
                {raisePresets.length > 0 && (
                    <div
                        className="chip-group"
                        style={{
                            marginBottom: isMobile ? 8 : 16,
                            justifyContent: isMobile ? "flex-start" : "center",
                            overflowX: isMobile ? "auto" : "visible",
                            whiteSpace: isMobile ? "nowrap" : "normal",
                            paddingBottom: isMobile ? 4 : 0, // Scrollbar space
                            flexShrink: 0
                        }}
                    >
                        {showBetPct && (
                            <button key="pct-33" className="chip" onClick={() => handleBetPct(0.33)}>33%</button>
                        )}
                        {/* Logic for Raise Presets derived from App.jsx IIFE */}
                        {(() => {
                            // Pre-flop logic
                            if (S.street === "PRE") {
                                const minToVal = +(base + inc).toFixed(2);
                                return [2, 2.5, 3, 4, 5].map((k) => {
                                    const cand = +(base * k).toFixed(2);
                                    const to = Math.max(cand, minToVal);
                                    const active = Number(raiseTo) === to;
                                    return (
                                        <button key={`rr-${k}`} className={`chip ${active ? "active" : ""}`} onClick={() => setRaiseTo(to)}>
                                            {`${k}x(${fmtBB(to)})`}
                                        </button>
                                    );
                                });
                            }
                            // Post-flop logic
                            const pctList = [0.25, 0.33, 0.5, 0.66, 0.75, 1.0, 1.25];
                            return pctList.map((p) => {
                                const sumBets = (S.bets || []).reduce((a, b) => a + b, 0);
                                const potBase = (S.pot || 0) + sumBets;
                                const want = +(potBase * p).toFixed(2);
                                const already = S.committed[S.actor] ?? 0;
                                const to = +(already + want).toFixed(2);
                                const active = Number(raiseTo) === to;
                                return (
                                    <button key={`pct-${p}`} className={`chip ${active ? "active" : ""}`} onClick={() => setRaiseTo(to)}>
                                        {`${Math.round(p * 100)}% (${fmtBB(to)})`}
                                    </button>
                                );
                            });
                        })()}
                        {/* Integrated All-In Chip */}
                        <button
                            className="chip"
                            style={{
                                background: "#4a151b",
                                borderColor: "#7f1d1d",
                                color: "#fca5a5",
                                fontWeight: "bold"
                            }}
                            onClick={() => onTo((S?.committed?.[S.actor] ?? 0) + (S?.stacks?.[S.actor] ?? 0))}
                            title="All-In"
                        >
                            ALL-IN
                        </button>
                    </div>
                )}

                {/* Slider & Actions Grid (Mobile Optimized) */}
                <div style={isMobile ? { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" } : {}}>

                    {/* PC: Slider and Raise Button wrap standard logic */}
                    {/* Mobile: Slider on top? Or Input Area? */}

                    {/* Unified Raise Block */}
                    <div className="raise-wrap" style={isMobile ? { width: "100%", gridColumn: "1 / -1" } : {}}>
                        <button
                            className="btn btn--primary raise-fixed"
                            onClick={() => { if (Number.isFinite(value)) onTo(+Number(value).toFixed(2)); }}
                            disabled={!legal.raise && !legal.bet}
                            title="決定"
                            style={isMobile ? { height: 36, fontSize: 12, padding: "0 10px" } : {}}
                        >
                            {S.currentBet === 0 ? "BET" : "RAISE"} {fmtBB(value)}
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
                    {!isMobile && <div className="bb-ticks"><span /><span /><span /></div>}


                </div>

            </div>

            {/* Analyze Button (if applicable) */}
            {canAnalyze && (
                <div style={{ marginTop: 8 }}>
                    <button
                        className="btn glow btn-accent"
                        onClick={doAnalyze}
                        disabled={analyzing}
                        style={{ width: "100%" }}
                    >
                        解析する
                    </button>
                </div>
            )}

        </div>
    );
}
