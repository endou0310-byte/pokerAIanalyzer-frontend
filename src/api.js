const BASE = "https://poker-backend-production-64cf.up.railway.app";

/**
 * メイン解析API
 */
export async function analyzeHand(payload) {
  const res = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`analyze failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * 追い質問API
 */
export async function followupQuestion(payload) {
  const res = await fetch(`${BASE}/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`followup failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * プラン情報取得API
 * GET /plan?user_id=...
 */
export async function fetchPlan(userId) {
  const res = await fetch(
    `${BASE}/plan?user_id=${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );

  // まだ /plan がサーバ側に無い（404）の場合は、
  // 「free プラン・回数無制限」として扱う
  if (res.status === 404) {
    return {
      ok: true,
      plan: "free",
      remaining_this_month: null,   // null = 無制限
      followups_per_hand: null,     // null = 無制限
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchPlan failed: ${res.status} ${text}`);
  }
  return res.json();
}


/* ここから履歴系API ----------------------------------- */

/**
 * 履歴保存
 * POST /history/save
 */
export async function saveHistory(payload) {
  const res = await fetch(`${BASE}/history/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`saveHistory failed: ${res.status} ${text}`);
  }
  // { ok:true, id: number }
  return res.json();
}

/**
 * 履歴一覧取得
 * GET /history/list?user_id=...
 */
export async function fetchHistoryList(userId) {
  const res = await fetch(
    `${BASE}/history/list?user_id=${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchHistoryList failed: ${res.status} ${text}`);
  }
  // { ok:true, items:[...] }
  return res.json();
}

/**
 * 履歴詳細取得
 * GET /history/detail?id=...
 */
export async function fetchHistoryDetail(id) {
  const res = await fetch(
    `${BASE}/history/detail?id=${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchHistoryDetail failed: ${res.status} ${text}`);
  }
  // { ok:true, history:{...} }
  return res.json();
}

/**
 * 履歴レコードの conversation を更新
 * POST /history/update-conversation
 *
 * @param {number} id hand_histories.id
 * @param {Array<{role:string,message:string}>} conversation
 */
export async function updateHistoryConversation(user_id, hand_id, conversation) {
  const res = await fetch(`${BASE}/history/update-conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id,
      hand_id,
      conversation,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`updateHistoryConversation failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Stripe チェックアウトセッション作成
 * POST /stripe/create-checkout-session
 */
export async function createCheckoutSession({ user_id, email, plan }) {
  const res = await fetch(`${BASE}/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, email, plan }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `createCheckoutSession failed: ${res.status} ${text}`
    );
  }

  // { ok:true, url:"https://checkout.stripe.com/..." }
  const json = await res.json();
  return json;
}

/**
 * Stripe Billing Portal セッション作成
 * POST /stripe/create-portal-session
 *
 * 返り値: { ok:true, url:"https://billing.stripe.com/..." }
 */
export async function createPortalSession({ user_id }) {
  const res = await fetch(`${BASE}/stripe/create-portal-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createPortalSession failed: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * サブスク解約（Netflix型：次回更新で停止）
 * POST /plan/cancel
 *
 * 返り値: { ok:true, cancel_at: ISOString|null }
 */
export async function cancelPlan({ user_id }) {
  const res = await fetch(`${BASE}/plan/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`cancelPlan failed: ${res.status} ${text}`);
  }

  return res.json();
}
