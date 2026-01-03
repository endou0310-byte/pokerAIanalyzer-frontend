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
 * 履歴保存
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
  return res.json();
}

/**
 * プラン取得
 */
export async function fetchPlan(user_id) {
  const res = await fetch(`${BASE}/plan?user_id=${encodeURIComponent(user_id)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchPlan failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * 会話（followup）の更新
 */
export async function updateHistoryConversation(payload) {
  const res = await fetch(`${BASE}/history/update_conversation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`updateHistoryConversation failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Stripe Checkout セッション作成
 */
export async function createCheckoutSession({ user_id, email, plan }) {
  const res = await fetch(`${BASE}/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, email, plan }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createCheckoutSession failed: ${res.status} ${text}`);
  }

  // { ok:true, url:"https://checkout.stripe.com/..." }
  const json = await res.json();
  return json;
}

/**
 * Stripe Billing Portal セッション作成
 * POST /stripe/create-portal-session
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
