import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/account-manager',  label: 'Account Manager' },
  { to: '/business-manager', label: 'Business Manager' },
  { to: '/call-center',      label: 'Call Center' },
  { to: '/delivery-ops',     label: 'Delivery Ops' },
  { to: '/ops-manager',      label: 'Ops Manager' },
  { to: '/simulate-call',    label: '📞 Simulate Call' },
]

export default function Topbar() {
  return (
    <div className="topbar">
      <h1>BiteFlow</h1>
      <nav className="topbar-nav">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
