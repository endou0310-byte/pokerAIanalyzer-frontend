import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyAeN9M4j-AltdefKy7KDHgiwiD-QliAiKQ",
    authDomain: "poker-analyzer-7f4b9.firebaseapp.com",
    projectId: "poker-analyzer-7f4b9",
    storageBucket: "poker-analyzer-7f4b9.firebasestorage.app",
    messagingSenderId: "812966343556",
    appId: "1:812966343556:web:c11066e3a4224a8ed323d1",
    measurementId: "G-C3E26986Q5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// イベント送信用のヘルパー関数
export const sendEvent = (eventName, params) => {
    try {
        logEvent(analytics, eventName, params);
    } catch (e) {
        console.error("GA4 Error:", e);
    }
};

export { app, analytics };
