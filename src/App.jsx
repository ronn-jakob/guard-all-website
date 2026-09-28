import Dashboard from "./components/Dashboard.jsx";
import Inventory from "./components/Inventory.jsx";
import Login from "./components/Login.jsx";
import Scheduling from "./components/Scheduling.jsx";
import SalesBilling from "./components/SalesBilling.jsx";
import FieldReports from "./components/FieldReports.jsx";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/billing" element={<SalesBilling />} />
        <Route path="/reports" element={<FieldReports />} />
      </Routes>
    </>
  );
}

export default App;
