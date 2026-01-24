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
    const safeNum = (n, def = 0) => (Number.isFinite(n) ? n : def);

    const inc = Math.max(1.0, safeNum(S.lastRaiseSize, 1.0));
    const base = safeNum(S.lastBetTo) || safeNum(S.currentBet) || 0;

    // minTo logic
    let minTo = safeNum(S.currentBet) === 0
        ? (S.street === "PRE" ? 2 : 1)
        : +(base + inc).toFixed(2);
    if (!Number.isFinite(minTo)) minTo = 2.0;

    // maxTo logic
    const stack = safeNum(S.stacks?.[S.actor]);
    const commit = safeNum(S.committed?.[S.actor]);
    const maxTo = +(stack + commit).toFixed(2);

    // Input value logic
    const value = Number.isFinite(Number(raiseTo)) ? Number(raiseTo) : minTo;

    // Handle slider pct for visuals
    const range = Math.max(1e-9, maxTo - minTo);
    const pct = Math.min(100, Math.max(0, ((value - minTo) / range) * 100));

    // ======================
    // PC Layout (New)
    // ======================
    if (!isMobile) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", maxWidth: 960, margin: "0 auto",
                background: "rgba(10, 15, 25, 0.75)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(135, 206, 250, 0.15)",
                borderRadius: 24, padding: "16px 24px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.4)"
            }}>
                {/* Left: General Actions */}
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    {onUndo && (
                        <button onClick={onUndo} title="Undo" style={{
                            width: 42, height: 42, borderRadius: "50%",
                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                            color: "#94a3b8", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                        }}>↩</button>
                    )}
                    <button onClick={onFold} disabled={!legal.fold} style={{
                        height: 48, minWidth: 100, borderRadius: 12,
                        background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#fca5a5", fontSize: 15, fontWeight: 700, cursor: !legal.fold ? "not-allowed" : "pointer", opacity: !legal.fold ? 0.4 : 1
                    }}>FOLD</button>

                    <button onClick={onCheck} disabled={!legal.check} style={{
                        height: 48, minWidth: 100, borderRadius: 12,
                        background: legal.check ? "rgba(255,255,255,0.08)" : "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e2e8f0", fontSize: 15, fontWeight: 700, cursor: !legal.check ? "not-allowed" : "pointer", opacity: !legal.check ? 0.3 : 1
                    }}>CHECK</button>

                    <button onClick={onCall} disabled={!legal.call} style={{
                        height: 48, minWidth: 100, borderRadius: 12,
                        background: legal.call ? "rgba(255,255,255,0.08)" : "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e2e8f0", fontSize: 15, fontWeight: 700, cursor: !legal.call ? "not-allowed" : "pointer", opacity: !legal.call ? 0.3 : 1
                    }}>CALL</button>
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />

                {/* Right: Betting */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {/* Presets Row */}
                    {/* Presets Row */}
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        {(() => {
                            if (S.street === "PRE") {
                                const minToVal = +(base + inc).toFixed(2);
                                return [2, 2.5, 3, 4, 5].map((k) => {
                                    const cand = +(base * k).toFixed(2);
                                    const to = Math.max(cand, minToVal);
                                    return (
                                        <button key={`pc-pre-${k}`} onClick={() => onTo(to)} style={{
                                            fontSize: 11, padding: "4px 10px", borderRadius: 20,
                                            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                                            color: "#cbd5e1", cursor: "pointer", transition: "0.2s"
                                        }}>
                                            {`${k}x (${fmtBB(to)})`}
                                        </button>
                                    );
                                });
                            } else {
                                // Post-flop: 33%, 50%, 75%, 100%, 125%
                                const pctList = [0.33, 0.5, 0.75, 1.0, 1.25];
                                return pctList.map((p) => {
                                    const sumBets = (S.bets || []).reduce((a, b) => a + b, 0);
                                    const potBase = (S.pot || 0) + sumBets;
                                    const want = +(potBase * p).toFixed(2);
                                    const already = S.committed[S.actor] ?? 0;
                                    const to = +(already + want).toFixed(2);
                                    return (
                                        <button key={`pc-post-${p}`} onClick={() => onTo(to)} style={{
                                            fontSize: 11, padding: "4px 10px", borderRadius: 20,
                                            background: "rgba(0, 212, 255, 0.1)", border: "1px solid rgba(0, 212, 255, 0.2)",
                                            color: "#7dd3fc", cursor: "pointer"
                                        }}>
                                            {p >= 1 ? "POT" : `${Math.round(p * 100)}%`} ({fmtBB(to)})
                                        </button>
                                    );
                                });
                            }
                        })()}
                        <button onClick={() => onTo(maxTo)} style={{
                            fontSize: 11, padding: "4px 10px", borderRadius: 20,
                            background: "rgba(255, 75, 92, 0.15)", border: "1px solid rgba(255, 75, 92, 0.3)",
                            color: "#fda4af", fontWeight: 700, cursor: "pointer"
                        }}>ALL-IN</button>
                    </div>

                    {/* Slider & Raise Input */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ position: "relative", flex: 1, height: 24, display: "flex", alignItems: "center" }}>
                            <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: "#334155", borderRadius: 2 }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: "#00d4ff", borderRadius: 2 }} />
                            </div>
                            <input type="range" min={minTo} max={maxTo} step={inc} value={value}
                                onChange={(e) => setRaiseTo(Math.min(maxTo, Math.max(minTo, Number(e.target.value))))}
                                style={{ width: "100%", height: 24, opacity: 0, cursor: "pointer", zIndex: 10, position: "absolute", top: 0, left: 0, margin: 0 }}
                            />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 4 }}>
                            <input type="number" value={raiseTo} onChange={(e) => setRaiseTo(e.target.value)}
                                style={{ width: 70, background: "transparent", border: "none", color: "#fff", textAlign: "right", fontSize: 16, fontWeight: 700, outline: "none" }}
                            />
                            <span style={{ fontSize: 11, color: "#94a3b8", paddingRight: 8 }}>BB</span>
                        </div>

                        <button disabled={!legal.raise} onClick={() => onTo(value)} style={{
                            height: 42, padding: "0 20px", borderRadius: 12,
                            background: "linear-gradient(135deg, #00d4ff 0%, #00aaff 100%)",
                            border: "none", color: "#0f172a", fontSize: 14, fontWeight: 800,
                            boxShadow: "0 0 15px rgba(0, 212, 255, 0.4)", cursor: !legal.raise ? "not-allowed" : "pointer", opacity: !legal.raise ? 0.5 : 1
                        }}>
                            RAISE
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
