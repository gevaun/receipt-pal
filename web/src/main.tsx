import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import "./index.css";
import { DataProvider } from "./lib/data";
import { Categories } from "./pages/Categories";
import { Dashboard } from "./pages/Dashboard";
import { Scan } from "./pages/Scan";
import { Settings } from "./pages/Settings";
import { Transactions } from "./pages/Transactions";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="scan" element={<Scan />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="categories" element={<Categories />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  </StrictMode>,
);
