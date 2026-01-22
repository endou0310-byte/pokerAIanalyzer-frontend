// 移植元準拠：to方式 / 最小レイズ / アクター遷移 / ストリート遷移
export const STREETS = ["PRE", "FLOP", "TURN", "RIVER"];
const R10 = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
const R9 = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
const R8 = ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
const R7 = ["UTG", "UTG+1", "HJ", "CO", "BTN", "SB", "BB"];
const R6 = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
const R4 = ["UTG", "BTN", "SB", "BB"];
const R3 = ["BTN", "SB", "BB"];
const R2 = ["BTN", "BB"];
const ringByPlayers = (n) => n <= 2 ? R2 : n === 3 ? R3 : n === 4 ? R4 : n === 6 ? R6 : n === 7 ? R7 : n === 8 ? R8 : n === 9 ? R9 : R10;

export function initialState(players, heroSeat, heroStack) {
  const seats = ringByPlayers(players);
  const btn = seats.indexOf("BTN");
  const sb = seats.indexOf("SB");
  const bb = seats.indexOf("BB");

  // 全員のスタックを user設定値 (=heroStack引数) で初期化
  const startStack = Number(heroStack) || 100;
  const stacks = Array(players).fill(startStack);

  // const h = seats.indexOf(heroSeat);
  // if (h >= 0) stacks[h] = startStack; // 既にfill済みなので不要だが念のため残すならこうなる

  const bets = Array(players).fill(0);
  const committed = Array(players).fill(0);
  const folded = Array(players).fill(false);

  if (players === 2) {
    stacks[btn] = Math.max(0, stacks[btn] - 0.5); bets[btn] += 0.5; committed[btn] += 0.5;
    stacks[bb] = Math.max(0, stacks[bb] - 1.0); bets[bb] += 1.0; committed[bb] += 1.0;
  } else {
    stacks[sb] = Math.max(0, stacks[sb] - 0.5); bets[sb] += 0.5; committed[sb] += 0.5;
    stacks[bb] = Math.max(0, stacks[bb] - 1.0); bets[bb] += 1.0; committed[bb] += 1.0;
  }

  return {
    seats, players,
    street: "PRE",
    pot: 1.5,

    stacks, bets, committed, folded,
    currentBet: 1.0,
    acted: new Set(),

    // 直前レイズの「増加分」を保持（初期はBB=1.0）
    lastBetTo: 1.0,
    lastRaiseSize: 1.0,
    aggressor: bb,

    actor: (players === 2) ? btn : seats.indexOf("UTG"),

    actions: { PRE: [], FLOP: [], TURN: [], RIVER: [] },
    board: { FLOP: [], TURN: [], RIVER: [] },
  };
}

const aliveIdx = (S) => [...Array(S.players).keys()].filter(i => !S.folded[i] && (S.stacks[i] ?? 0) > 0);

export function legal(S) {
  if (S.actor < 0) return { fold: false, check: false, call: false, bet: false, raise: false };
  return {
    fold: !S.folded[S.actor],
    check: S.currentBet === S.committed[S.actor],
    call: S.currentBet > S.committed[S.actor],
    bet: S.currentBet === 0,
    raise: S.currentBet > 0,
  };
}

function nextIdx(S, i) {
  const start = (i + 1) % S.players;
  let k = start;
  let tried = 0;
  while (tried < S.players) {
    if (!S.folded[k] && (S.stacks[k] ?? 0) > 0) return k;
    k = (k + 1) % S.players;
    tried++;
  }
  return -1;
}

function pushAction(S, obj) {
  S.actions[S.street] = [...S.actions[S.street], obj];
}

export function actFold(S) {
  S.folded = S.folded.slice(); S.folded[S.actor] = true;
  pushAction(S, { actor: S.seats[S.actor], type: "FOLD" });
  S.acted = new Set([...S.acted, S.actor]);
  rotateOrStreet(S);
}

export function actCheck(S) {
  pushAction(S, { actor: S.seats[S.actor], type: "CHECK" });
  S.acted = new Set([...S.acted, S.actor]);
  rotateOrStreet(S);
}

export function actCall(S) {
  const need = Math.max(0, S.currentBet - S.committed[S.actor]);
  const put = Math.min(need, S.stacks[S.actor] ?? 0);

  const ns = S.stacks.slice(); ns[S.actor] = Math.max(0, ns[S.actor] - put);
  const nc = S.committed.slice(); nc[S.actor] += put;
  const nb = S.bets.slice(); nb[S.actor] += put;

  S.stacks = ns; S.committed = nc; S.bets = nb;
  pushAction(S, { actor: S.seats[S.actor], type: "CALL", put });

  S.acted = new Set([...S.acted, S.actor]);
  rotateOrStreet(S);
}

export function actTo(S, to) {
  // 直前レイズ増分に基づく最小 To
  const minRaiseSize = S.currentBet === 0 ? 1.0 : Math.max(1.0, S.lastRaiseSize || 1.0);
  const minTo = S.currentBet === 0 ? to : (S.lastBetTo + minRaiseSize);
  const toFixed = +(Math.max(to, minTo)).toFixed(2);

  const need = Math.max(0, toFixed - S.committed[S.actor]);
  if (need <= 0) return;

  const ns = S.stacks.slice(); ns[S.actor] = Math.max(0, ns[S.actor] - need);
  const nc = S.committed.slice(); nc[S.actor] += need;
  const nb = S.bets.slice(); nb[S.actor] += need;

  const prevBet = S.currentBet;

  S.stacks = ns; S.committed = nc; S.bets = nb;
  pushAction(S, { actor: S.seats[S.actor], type: (S.currentBet === 0 ? "BET" : "RAISE"), to: toFixed, put: need });

  // ここが修正点：直前レイズの「増加分」を保持
  S.lastRaiseSize = Math.max(1.0, +(toFixed - prevBet).toFixed(2));
  S.lastBetTo = toFixed;
  S.currentBet = toFixed;
  S.aggressor = S.actor;

  S.acted = new Set([S.actor]);
  rotateOrStreet(S);
}

function settleStreetAndMaybeNext(S) {
  const sum = S.bets.reduce((a, b) => a + b, 0);
  if (sum > 0) S.pot = +(S.pot + sum).toFixed(2);
  S.bets = Array(S.players).fill(0);

  S.committed = Array(S.players).fill(0);
  S.currentBet = 0;
  S.acted = new Set();
  S.aggressor = null;
  S.lastBetTo = 0;
  S.lastRaiseSize = 1.0; // 次ストリートの初期増分は 1bb

  const btn = S.seats.indexOf("BTN");
  const start = (btn + 1) % S.players;
  let k = start, loop = 0;
  while (loop < S.players) {
    if (!S.folded[k] && (S.stacks[k] ?? 0) > 0) { S.actor = k; break; }
    k = (k + 1) % S.players; loop++;
  }
}

function rotateOrStreet(S) {
  const actives = aliveIdx(S);

  if (actives.length <= 1) {
    settleStreetAndMaybeNext(S);
    S.actor = -1;
    return;
  }

  const pend = S.currentBet === 0
    ? actives.filter(i => !S.acted.has(i))
    : actives.filter(i => S.committed[i] !== S.currentBet || !S.acted.has(i));

  if (pend.length === 0) {
    if (S.street === "RIVER") {
      settleStreetAndMaybeNext(S);
      S.actor = -1;
    } else {
      const nextStreet = { PRE: "FLOP", FLOP: "TURN", TURN: "RIVER" }[S.street];
      S.street = nextStreet;
      settleStreetAndMaybeNext(S);
    }
    return;
  }

  S.actor = nextIdx(S, S.actor);
}

export function presets(S) {
  if (S.currentBet === 0) {
    const opens = [2, 2.5, 3, 3.5, 4];
    return opens.map(v => ({ label: `${v}x (${v.toFixed(2)}bb)`, to: +v.toFixed(2) }));
  }
  const minRaiseSize = Math.max(1.0, S.lastRaiseSize || 1.0);
  const tos = [1, 1.5, 2, 2.5, 3].map(k => S.lastBetTo + k * minRaiseSize);
  return tos.map(t => ({ label: `to ${t.toFixed(2)}bb`, to: +t.toFixed(2) }));
}
