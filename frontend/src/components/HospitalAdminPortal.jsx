import React, { useState, useEffect } from 'react';
import { loginDoctor, getAdminQueue, getAdminAlerts, getAdminAnalytics } from '../api';
import {
  Users, AlertTriangle, Clock, RefreshCw, BarChart2, ShieldAlert,
  ArrowRight, ShieldCheck, CheckCircle2, User, Key, Activity, HeartPulse
} from 'lucide-react';

export default function HospitalAdminPortal({ onViewDoctorSession }) {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Live Data
  const [queueData, setQueueData] = useState([]);
  const [counts, setCounts] = useState({
    total_today: 0,
    pending_review: 0,
    red_flag_active: 0,
    in_progress: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  
  // Controls
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'analytics'

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    try {
      const res = await loginDoctor(username, password);
      setToken(res.token);
    } catch (err) {
      setAuthError(err.message || 'Login failed. Check admin credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const [qRes, aRes, statRes] = await Promise.all([
        getAdminQueue(token, statusFilter),
        getAdminAlerts(token),
        getAdminAnalytics(token)
      ]);
      setQueueData(qRes.queue || []);
      setCounts(qRes.counts || { total_today: 0, pending_review: 0, red_flag_active: 0, in_progress: 0 });
      setAlerts(aRes.alerts || []);
      setAnalytics(statRes || null);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 15000); // refresh every 15s
      return () => clearInterval(interval);
    }
  }, [token, statusFilter]);

  if (!token) {
    return (
      <div className="login-container" style={{ maxWidth: '420px', margin: '6rem auto', padding: '2.5rem', background: '#fff', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: '#7c3aed', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.5rem', color: '#0f172a' }}>Admin Control Room</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>Access hospital operational analytics & live queues</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Username</label>
            <input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Password</label>
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {authError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600 }}>
              {authError}
            </div>
          )}

          <button type="submit" className="action-btn" style={{ width: '100%', background: '#7c3aed', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)' }} disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Access Control Room'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'slideUp 0.3s ease' }}>
      
      {/* 1. Header Bar with stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Activity color="#7c3aed" size={32} /> Command Center
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.94rem' }}>Real-time pre-consultation flow & clinical risk dashboard</p>
        </div>

        {/* Refresh controls & tab toggler */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <button 
              onClick={() => setActiveTab('queue')} 
              style={{ background: activeTab === 'queue' ? 'white' : 'none', border: 'none', borderRadius: '10px', padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600, color: activeTab === 'queue' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: activeTab === 'queue' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}
            >
              Live Queue
            </button>
            <button 
              onClick={() => setActiveTab('analytics')} 
              style={{ background: activeTab === 'analytics' ? 'white' : 'none', border: 'none', borderRadius: '10px', padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600, color: activeTab === 'analytics' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: activeTab === 'analytics' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}
            >
              Analytics
            </button>
          </div>

          <button onClick={fetchData} className="summary-card" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '8px 14px', background: '#fff', cursor: 'pointer', margin: 0 }}>
            <RefreshCw size={14} /> <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Top Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="summary-card" style={{ borderLeft: '5px solid #2563eb', padding: '1.5rem', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Registered</span>
            <Users size={18} color="#2563eb" />
          </div>
          <strong style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{counts.total_today}</strong>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>Since midnight today</div>
        </div>

        <div className="summary-card" style={{ borderLeft: '5px solid #eab308', padding: '1.5rem', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pending Review</span>
            <Clock size={18} color="#eab308" />
          </div>
          <strong style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{counts.pending_review}</strong>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>Awaiting doctor action</div>
        </div>

        <div className="summary-card" style={{ borderLeft: '5px solid #dc2626', padding: '1.5rem', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Red Flags Active</span>
            <AlertTriangle size={18} color="#dc2626" />
          </div>
          <strong style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{counts.red_flag_active}</strong>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>High-severity priority triage</div>
        </div>

        <div className="summary-card" style={{ borderLeft: '5px solid #10b981', padding: '1.5rem', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>In Progress</span>
            <Activity size={18} color="#10b981" />
          </div>
          <strong style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{counts.in_progress}</strong>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>Currently at Patient Kiosks</div>
        </div>
      </div>

      {activeTab === 'queue' ? (
        /* 3. General Queue & Alerts Side-by-side */
        <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.2fr', gap: '1.5rem' }}>
          
          {/* Main Queue table */}
          <div className="summary-card" style={{ padding: '1.5rem', background: '#fff', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eaecf0', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700 }}>Live Operational Queue</h2>
              
              {/* status dropdown filter */}
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)} 
                className="form-select" 
                style={{ width: '180px', padding: '6px 12px', fontSize: '0.82rem', margin: 0 }}
              >
                <option value="">All statuses</option>
                <option value="red_flag">Red Flag Active</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_summary">Awaiting Summary</option>
                <option value="summary_ready">Summary Ready</option>
                <option value="doctor_reviewed">Doctor Reviewed</option>
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eaecf0', color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>ID</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>PATIENT</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>TOKEN</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>MODE</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>WAIT</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>STATUS</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {queueData.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                        No active sessions matching criteria.
                      </td>
                    </tr>
                  ) : (
                    queueData.map(session => (
                      <tr 
                        key={session.session_id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9', 
                          fontSize: '0.88rem', 
                          background: session.red_flag ? '#fef2f2' : 'none',
                          borderLeft: session.red_flag ? '4px solid #dc2626' : '4px solid transparent'
                        }}
                      >
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#64748b' }}>#{session.session_id}</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {session.patient_name}
                            {session.assisted_mode && (
                              <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>Assisted Mode</span>
                            )}
                            {session.needed_clarification && (
                              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>Needs Clarification</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {session.token ? (
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                              {session.token}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                          {session.token_status && (
                            <span style={{ marginLeft: '0.3rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: session.token_status === 'approved' ? '#059669' : session.token_status === 'rejected' ? '#dc2626' : '#d97706' }}>
                              ({session.token_status})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>
                          <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', background: session.mode === 'ayush' ? '#ecfdf5' : '#eff6ff', color: session.mode === 'ayush' ? '#065f46' : '#1e40af', fontWeight: 700 }}>
                            {session.mode}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                          <span style={{ color: session.waiting_minutes > 15 ? '#dc2626' : '#64748b' }}>
                            {session.waiting_minutes}m
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize', fontWeight: 600 }}>
                          <span style={{ 
                            color: session.status === 'doctor_reviewed' ? '#059669' : 
                                   session.status === 'summary_ready' ? '#2563eb' : '#d97706'
                          }}>
                            {session.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <button 
                            className="summary-card-field active-source" 
                            onClick={() => onViewDoctorSession(session.session_id)} 
                            style={{ margin: 0, padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                          >
                            Open Chart <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dedicated Alerts Feed */}
          <div className="summary-card" style={{ padding: '1.5rem', background: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid #dc2626' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={20} /> Red Flag Alerts
            </h2>
            <div style={{ display: 'flex', flexType: 'column', gap: '0.75rem', flexDirection: 'column', overflowY: 'auto', maxHeight: '450px' }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '2rem' }}>
                  No active red flag sessions flagged today.
                </div>
              ) : (
                alerts.map(alert => (
                  <div 
                    key={alert.session_id} 
                    style={{ 
                      padding: '0.9rem', 
                      background: '#fef2f2', 
                      borderRadius: '12px', 
                      border: '1px solid #fca5a5', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.3rem' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#991b1b' }}>{alert.patient_name}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>#{alert.session_id}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#7f1d1d', lineHeight: '1.4' }}>
                      {alert.red_flag_reason || 'Unknown clinical triage alert.'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', borderTop: '1px solid #fecaca', paddingTop: '0.4rem', fontSize: '0.72rem', color: '#991b1b' }}>
                      <span>Token: <strong>{alert.token || 'N/A'}</strong> ({alert.token_status || 'none'})</span>
                      <span>{alert.flagged_at ? new Date(alert.flagged_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Analytics section with charts */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Key metrics grid */}
          {analytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="summary-card" style={{ padding: '1.25rem', background: '#fff' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Red Flag Incidence Rate</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                  {Math.round(analytics.red_flag_rate * 100)}%
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${analytics.red_flag_rate * 100}%`, height: '100%', background: '#dc2626' }}></div>
                </div>
              </div>

              <div className="summary-card" style={{ padding: '1.25rem', background: '#fff' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Avg Intake Turn Depth</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                  {analytics.avg_interview_turns} turns
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Target: 5.0 - 8.0 conversational turns</span>
              </div>

              <div className="summary-card" style={{ padding: '1.25rem', background: '#fff' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>OCR Field Extract Confidence</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                  {Math.round(analytics.avg_ocr_confidence * 100)}%
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${analytics.avg_ocr_confidence * 100}%`, height: '100%', background: '#10b981' }}></div>
                </div>
              </div>

              <div className="summary-card" style={{ padding: '1.25rem', background: '#fff' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Average Flow-to-Token Duration</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                  {analytics.avg_time_to_token_minutes} min
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Registration to Token generated</span>
              </div>
            </div>
          )}

          {/* Visualizing breakdowns using CSS bar layouts */}
          {analytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              
              {/* Complaints breakdown */}
              <div className="summary-card" style={{ padding: '1.5rem', background: '#fff' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid #eaecf0', paddingBottom: '0.5rem' }}>
                  Chief Complaint Incidence Breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {Object.keys(analytics.complaint_breakdown).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No data</div>
                  ) : (
                    Object.entries(analytics.complaint_breakdown).map(([complaint, count]) => {
                      const maxVal = Math.max(...Object.values(analytics.complaint_breakdown));
                      const percent = maxVal > 0 ? (count / maxVal) * 100 : 0;
                      return (
                        <div key={complaint}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                            <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#374151' }}>{complaint}</span>
                            <strong style={{ color: '#0f172a' }}>{count}</strong>
                          </div>
                          <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', borderRadius: '5px' }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Mode & Language breakdowns */}
              <div className="summary-card" style={{ padding: '1.5rem', background: '#fff', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid #eaecf0', paddingBottom: '0.5rem' }}>
                    Care Stream (Mode) Distribution
                  </h3>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    {Object.entries(analytics.mode_breakdown).map(([mode, count]) => {
                      const percent = analytics.total_sessions > 0 ? Math.round((count / analytics.total_sessions) * 100) : 0;
                      return (
                        <div key={mode} style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>{mode}</span>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>{count}</div>
                          <div style={{ fontSize: '0.78rem', color: mode === 'ayush' ? '#0d9488' : '#2563eb', fontWeight: 700 }}>{percent}% of total</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid #eaecf0', paddingBottom: '0.5rem' }}>
                    Language Preference
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {Object.entries(analytics.language_breakdown).map(([langCode, count]) => (
                      <span key={langCode} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}>
                        <span style={{ textTransform: 'uppercase', color: '#64748b', marginRight: '0.3rem' }}>{langCode}:</span>
                        <strong style={{ color: '#0f172a' }}>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Token outcomes & Receptionist Validation stats */}
              <div className="summary-card" style={{ padding: '1.5rem', background: '#fff' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid #eaecf0', paddingBottom: '0.5rem' }}>
                  Intake Token Review Status
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>Clarification Requested by Receptionist</span>
                      <strong style={{ color: '#0f172a' }}>{Math.round(analytics.clarification_needed_rate * 100)}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${analytics.clarification_needed_rate * 100}%`, height: '100%', background: '#d97706' }}></div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>Token Status Breakdown</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { label: 'Approved & Pushed', count: analytics.token_outcomes.approved, color: '#10b981' },
                        { label: 'Rejected', count: analytics.token_outcomes.rejected, color: '#dc2626' },
                        { label: 'Pending Review', count: analytics.token_outcomes.pending, color: '#d97706' }
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#4b5563', fontWeight: 600 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></span>
                            {item.label}
                          </span>
                          <strong style={{ color: '#0f172a' }}>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
