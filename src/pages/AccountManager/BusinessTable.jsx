export default function BusinessTable({ businesses, areas = [], onResend, onDispatch, onAssignArea, onToggleActive, onViewDispatches }) {
  if (!businesses.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏪</div>
        <p>No businesses registered yet.<br />Click <strong>Add New Business</strong> to get started.</p>
      </div>
    )
  }

  const areaMap = Object.fromEntries(areas.map(a => [a.id, a]))

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Restaurant</th>
            <th>Address</th>
            <th>Phone</th>
            <th>Area</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map(b => {
            const area = b.areaId ? areaMap[b.areaId] : null
            return (
              <tr key={b.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#999', marginTop: 2 }}>ID: {b.id.slice(0, 8)}</div>
                </td>
                <td style={{ color: '#666' }}>{b.address || '—'}</td>
                <td style={{ color: '#666' }}>{b.phone   || '—'}</td>
                <td>
                  {area
                    ? <span style={{ fontSize: '0.82rem', color: '#e85d04', fontWeight: 500 }}>{area.name}</span>
                    : <span style={{ fontSize: '0.82rem', color: '#bbb' }}>Unassigned</span>
                  }
                </td>
                <td>
                  <span className={`badge ${b.active !== false ? 'badge-active' : 'badge-danger'}`}>
                    {b.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => onAssignArea(b)}>
                    📍 Area
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onResend(b)}>
                    📲 Resend
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDispatch(b)}>
                    🔧 IT
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onViewDispatches(b)}>
                    📋 History
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: b.active !== false ? '#ef4444' : '#16a34a' }}
                    onClick={() => onToggleActive(b)}
                  >
                    {b.active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
