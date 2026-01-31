/**
 * Google Play Billing (Digital Goods API) Helper
 * 
 * TWA (Trusted Web Activity) 環境でのみ動作します。
 * 通常のブラウザでは window.getDigitalGoodsService が存在しないためフォールバックが必要です。
 */

const PAYMENT_METHOD = "https://play.google.com/billing";

/**
 * Digital Goods Service が利用可能かチェック
 */
export async function isDigitalGoodsSupported() {
    return typeof window !== "undefined" && "getDigitalGoodsService" in window;
}

/**
 * 商品詳細を取得
 * @param {string[]} skuList - Google Play Consoleで設定した商品IDの配列
 */
export async function getSkuDetails(skuList) {
    if (!skuList || skuList.length === 0) return [];

    try {
        const service = await window.getDigitalGoodsService(PAYMENT_METHOD);
        // getDetails returns ItemDetails objects
        // https://developer.mozilla.org/en-US/docs/Web/API/DigitalGoodsService/getDetails
        const details = await service.getDetails(skuList);
        return details;
    } catch (error) {
        console.warn("Digital Goods API Error (getDetails):", error);
        return [];
    }
}

/**
 * 購入フローを開始
 * @param {string} sku - 購入する商品ID
 */
export async function purchaseSku(sku) {
    try {
        const service = await window.getDigitalGoodsService(PAYMENT_METHOD);

        // PaymentRequest API を使用して購入UIを表示
        // https://developer.mozilla.org/en-US/docs/Web/API/DigitalGoodsService

        const paymentMethodData = [{
            supportedMethods: PAYMENT_METHOD,
            data: {
                sku: sku,
            },
        }];

        const request = new PaymentRequest(paymentMethodData);
        const response = await request.show();

        // 購入成功時には purchaseToken が返る
        const token = response.details.token;

        // 本来はここでバックエンド検証を行うが、まずはトークンを返す
        // response.complete('success') は検証後に呼ぶのが一般的だが、
        // UIを閉じるために一旦呼んでしまうパターンもある。
        // ここでは呼び出し元で complete させるか、ここで閉じるか設計次第。
        // Simple verification flow:

        return {
            token: token,
            details: response.details,
            paymentResponse: response // 検証後に response.complete() を呼ぶため返す
        };

    } catch (error) {
        console.error("Purchase Failed:", error);
        throw error;
    }
}
