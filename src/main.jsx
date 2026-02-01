import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import AppRouter from "./AppRouter.jsx";
import "./styles.css";

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <HashRouter>
            <AppRouter />
        </HashRouter>
    </React.StrictMode>
);
