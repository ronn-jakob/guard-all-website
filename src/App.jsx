import Dashboard from "./components/Dashboard.jsx";
import Inventory from "./components/Inventory.jsx";
import Login from "./components/Login.jsx";
import Scheduling from "./components/Scheduling.jsx";
import JobFormPage from "./components/JobFormPage.jsx";
import SalesBilling from "./components/SalesBilling.jsx";
import InvoiceFormPage from "./components/InvoiceFormPage.jsx";
import JobTemplates from "./components/JobTemplates.jsx";
import FieldReports from "./components/FieldReports.jsx";
import ReportsOverview from "./components/ReportsOverview.jsx";
import Account from "./components/Account.jsx";
import Settings from "./components/Settings.jsx";
import ForgotPassword from "./components/ForgotPassword.jsx";
import { Navigate, Route, Routes } from "react-router-dom";
import { canAccessModule, getSession } from "./lib/auth.js";

function ProtectedRoute({ module, anyModule, disallowRole, children }) {
  const session = getSession();
  if (!session) return <Navigate replace to="/" />;
  if (module && !canAccessModule(module, session.user.role)) {
    return <Navigate replace to="/dashboard" />;
  }
  if (
    anyModule &&
    !anyModule.some((allowedModule) =>
      canAccessModule(allowedModule, session.user.role),
    )
  ) {
    return <Navigate replace to="/dashboard" />;
  }
  if (disallowRole && session.user.role === disallowRole) {
    return <Navigate replace to="/reports/new" />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/scheduling" element={<ProtectedRoute module="scheduling"><Scheduling /></ProtectedRoute>} />
      <Route path="/scheduling/new" element={<ProtectedRoute module="scheduling"><JobFormPage /></ProtectedRoute>} />
      <Route path="/scheduling/:order/edit" element={<ProtectedRoute module="scheduling"><JobFormPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute module="inventory"><Inventory /></ProtectedRoute>} />
      <Route path="/inventory/allocate" element={<ProtectedRoute anyModule={["scheduling", "inventory"]}><Inventory /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute module="sales_billing"><SalesBilling /></ProtectedRoute>} />
      <Route path="/billing/new" element={<ProtectedRoute module="sales_billing"><InvoiceFormPage /></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute module="sales_billing"><JobTemplates /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute disallowRole="Technician" module="field_reporting"><ReportsOverview /></ProtectedRoute>} />
      <Route path="/reports/new" element={<ProtectedRoute module="field_reporting"><FieldReports /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute module="admin"><Account /></ProtectedRoute>} />
      <Route path="/account/new" element={<ProtectedRoute module="admin"><Account /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Routes>
  );
}

export default App;
