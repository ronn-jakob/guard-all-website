import Dashboard from "./components/Dashboard.jsx";
import Inventory from "./components/Inventory.jsx";
import Login from "./components/Login.jsx";
import Scheduling from "./components/Scheduling.jsx";
import SalesBilling from "./components/SalesBilling.jsx";
import FieldReports from "./components/FieldReports.jsx";
import ReportsOverview from "./components/ReportsOverview.jsx";
import Account from "./components/Account.jsx";
import Settings from "./components/Settings.jsx";
import ForgotPassword from "./components/ForgotPassword.jsx";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/scheduling" element={<Scheduling />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/billing" element={<SalesBilling />} />
      <Route path="/reports" element={<ReportsOverview />} />
      <Route path="/reports/new" element={<FieldReports />} />
      <Route path="/account" element={<Account />} />
      <Route path="/account/new" element={<Account />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Routes>
  );
}

export default App;
