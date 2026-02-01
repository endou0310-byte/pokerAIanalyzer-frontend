import React from 'react';
import { Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import HandResult from './pages/HandResult.jsx';

/**
 * AppRouter - アプリケーションのルーティング
 */
export default function AppRouter() {
    return (
        <Routes>
            {/* メインアプリ */}
            <Route path="/" element={<App />} />

            {/* ハンド結果共有ページ */}
            <Route path="/hand/:handId" element={<HandResult />} />
        </Routes>
    );
}
