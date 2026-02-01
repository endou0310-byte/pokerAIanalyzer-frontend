// Vite: .env に VITE_API_BASE=... を設定（未設定時は従来URLにフォールバック）
const BASE =
  import.meta?.env?.VITE_API_BASE ||
  "https://poker-backend-production-64cf.up.railway.app";

// 共通リクエスト（JSON/テキストどっちが返ってきても落ちにくくする）
async function requestJson(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const raw = await res.text().catch(() => "");
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // 502などでHTMLが返ってもここでは落とさない
  }

  if (!res.ok) {
    const detail = data ? JSON.stringify(data) : raw;
    throw new Error(`${path} failed: ${res.status} ${detail}`);
  }

  // 成功時：JSONが取れたらJSON、取れなければ raw を返す
  return data ?? { ok: true, raw };
}

/**
 * メイン解析API
 */
export function analyzeHand(payload) {
  return requestJson("/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
/**
 * 追い質問API
 */
export function followupQuestion(payload) {
  return requestJson("/followup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
 * handIdから解析結果を取得
 */
export async function fetchHandById(handId) {
  const res = await fetch(`${BASE}/hand/${encodeURIComponent(handId)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchHandById failed: ${res.status} ${text}`);
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
export async function updateHistoryConversation(a, b, c) {
  // 互換：updateHistoryConversation(payload) でも
  //       updateHistoryConversation(user_id, hand_id, conversation) でも動くようにする
  const payload =
    typeof a === "object" && a !== null
      ? a
      : { user_id: a, hand_id: b, conversation: c };

  const res = await fetch(`${BASE}/history/update-conversation`, {
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

/**
 * プラン変更（既存課金ユーザーの upgrade / downgrade予約）
 * POST /plan/change
 * body: { user_id, new_plan }
 * 返り値例: { ok:true, action:"upgrade"|"downgrade_scheduled"|... }
 */
export async function changePlan({ user_id, new_plan }) {
  const res = await fetch(`${BASE}/plan/change`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, new_plan }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`changePlan failed: ${res.status} ${text}`);
  }

  return res.json();
}
