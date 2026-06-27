import { useState, useEffect, useRef, useCallback } from 'react'
import { createIncomingCall, listenToCall, endCall } from '../../firebase/db'

const DEMO_NUMBERS = ['0521234567', '0537654321', '0549876543', '0521000001']
const LS_KEY = 'bf_sim_call'

export default function SimulateCall() {
  const [phone, setPhone]       = useState('')
  const [callId, setCallId]     = useState(null)
  const [status, setStatus]     = useState('idle')   // idle | ringing | answered | ended
  const [operator, setOperator] = useState(null)
  const [seconds, setSeconds]   = useState(0)
  const timerRef                = useRef(null)
  const unsubRef                = useRef(null)
  const answeredAtRef           = useRef(null)

  const reset = useCallback(() => {
    clearInterval(timerRef.current)
    unsubRef.current?.()
    localStorage.removeItem(LS_KEY)
    setCallId(null); setStatus('idle'); setOperator(null); setSeconds(0)
  }, [])

  const handleCallUpdate = useCallback((updated) => {
    if (updated.status === 'answered' && !answeredAtRef.current) {
      answeredAtRef.current = Date.now()
      setStatus('answered')
      setOperator(updated.operatorName)
      localStorage.setItem(LS_KEY, JSON.stringify({
        id: updated.id, phone: updated.phone,
        status: 'answered', operatorName: updated.operatorName,
        answeredAt: answeredAtRef.current,
      }))
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - answeredAtRef.current) / 1000))
      }, 1000)
    }
    if (updated.status === 'ended') {
      clearInterval(timerRef.current)
      unsubRef.current?.()
      localStorage.removeItem(LS_KEY)
      setStatus('ended')
      setTimeout(reset, 2000)
    }
  }, [reset])

  // Restore state when navigating back to this tab
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (!saved) return
    try {
      const s = JSON.parse(saved)
      if (!s.id || s.status === 'ended') { localStorage.removeItem(LS_KEY); return }
      setCallId(s.id); setPhone(s.phone); setStatus(s.status)
      if (s.status === 'answered' && s.answeredAt) {
        setOperator(s.operatorName || null)
        answeredAtRef.current = s.answeredAt
        timerRef.current = setInterval(() => {
          setSeconds(Math.floor((Date.now() - s.answeredAt) / 1000))
        }, 1000)
      }
      unsubRef.current = listenToCall(s.id, handleCallUpdate)
    } catch { localStorage.removeItem(LS_KEY) }

    return () => { clearInterval(timerRef.current); unsubRef.current?.() }
  }, [handleCallUpdate])

  async function handleCall() {
    if (!phone.trim()) return
    const call = await createIncomingCall(phone.trim())
    setCallId(call.id); setStatus('ringing'); setSeconds(0)
    answeredAtRef.current = null
    localStorage.setItem(LS_KEY, JSON.stringify({ id: call.id, phone: phone.trim(), status: 'ringing' }))
    unsubRef.current = listenToCall(call.id, handleCallUpdate)
  }

  async function handleHangUp() {
    clearInterval(timerRef.current)
    unsubRef.current?.()
    if (callId) await endCall(callId)
    localStorage.removeItem(LS_KEY)
    reset()
  }

  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 54px)',
      background: '#111',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 300,
        background: '#1c1c1e',
        borderRadius: 40,
        padding: '40px 24px 36px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        textAlign: 'center',
        color: 'white',
      }}>
        {/* Status line */}
        <div style={{ fontSize: '0.75rem', color: '#888', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
          {status === 'idle'     && 'BiteFlow Call Simulator'}
          {status === 'ringing'  && 'Calling BiteFlow…'}
          {status === 'answered' && `Connected · ${formatTime(seconds)}`}
          {status === 'ended'    && 'Call Ended'}
        </div>

        {/* Big label */}
        <div style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: 6 }}>
          {status === 'idle'     && 'BiteFlow'}
          {status === 'ringing'  && phone}
          {status === 'answered' && (operator || 'Operator')}
          {status === 'ended'    && 'Disconnected'}
        </div>

        {status === 'answered' && (
          <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: 4 }}>Call Center Operator</div>
        )}

        {/* Ringing animation */}
        {status === 'ringing' && (
          <div style={{ margin: '24px auto', width: 72, height: 72, position: 'relative' }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(52,199,89,0.2)',
                animation: `pulse 1.4s ease-out infinite ${i * 0.4}s`,
              }} />
            ))}
            <div style={{
              position: 'absolute', inset: 16, borderRadius: '50%',
              background: '#34c759',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem',
            }}>
              📞
            </div>
          </div>
        )}

        {/* Idle: number picker + call button */}
        {status === 'idle' && (
          <>
            <div style={{ margin: '24px 0 8px', fontSize: '0.78rem', color: '#666' }}>
              Pick a demo customer:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
              {DEMO_NUMBERS.map(n => (
                <button key={n} onClick={() => setPhone(n)} style={{
                  background: phone === n ? '#34c759' : '#2c2c2e',
                  color: phone === n ? 'white' : '#aaa',
                  border: 'none', borderRadius: 12, padding: '4px 10px',
                  fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {n}
                </button>
              ))}
            </div>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Or type a number"
              style={{
                width: '100%', background: '#2c2c2e', border: 'none', borderRadius: 12,
                padding: '10px 14px', color: 'white', fontSize: '1rem',
                textAlign: 'center', marginBottom: 20, outline: 'none',
              }}
            />
            <button onClick={handleCall} disabled={!phone.trim()} style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none',
              background: phone.trim() ? '#34c759' : '#2c2c2e',
              color: 'white', fontSize: '1.6rem',
              cursor: phone.trim() ? 'pointer' : 'default',
              boxShadow: phone.trim() ? '0 4px 20px rgba(52,199,89,0.5)' : 'none',
              transition: 'all 0.2s',
            }}>
              📞
            </button>
          </>
        )}

        {/* Hang up (ringing or in-call) */}
        {(status === 'ringing' || status === 'answered') && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: 12 }}>
              {status === 'ringing' ? 'Waiting for operator…' : `On call with ${operator || 'operator'}`}
            </div>
            <button onClick={handleHangUp} style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none',
              background: '#ff3b30', color: 'white', fontSize: '1.6rem',
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,59,48,0.5)',
            }}>
              📵
            </button>
          </div>
        )}

        {status === 'ended' && (
          <div style={{ marginTop: 24, color: '#555', fontSize: '0.85rem' }}>
            Returning to dialer…
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
