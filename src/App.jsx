import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Topbar from './components/Topbar'
import AccountManager  from './pages/AccountManager'
import BusinessManager from './pages/BusinessManager'
import CallCenter      from './pages/CallCenter'
import DeliveryOps     from './pages/DeliveryOps'
import OpsManager      from './pages/OpsManager'
import SimulateCall    from './pages/SimulateCall'

export default function App() {
  return (
    <BrowserRouter>
      <Topbar />
      <Routes>
        <Route path="/"                 element={<Navigate to="/account-manager" replace />} />
        <Route path="/account-manager"  element={<AccountManager />} />
        <Route path="/business-manager" element={<BusinessManager />} />
        <Route path="/call-center"      element={<CallCenter />} />
        <Route path="/delivery-ops"     element={<DeliveryOps />} />
        <Route path="/ops-manager"      element={<OpsManager />} />
        <Route path="/simulate-call"    element={<SimulateCall />} />
      </Routes>
    </BrowserRouter>
  )
}
