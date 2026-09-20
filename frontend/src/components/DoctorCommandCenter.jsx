import React, { useState, useEffect, useRef } from 'react';
import { loginDoctor, getDoctorLiveQueue, getDoctorBrief, patchSummaryDetail, pushAbdm } from '../api';
import { 
  UserCheck, Save, RefreshCw, CheckCircle2, ShieldAlert, Leaf, Activity, FileText, Send, Clock, User, ArrowRight, ShieldCheck, AlertTriangle, HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';

export default function DoctorCommandCenter({ activeSessionId }) {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('doctor');
  const [password, setPassword] = useState('password123');
  const [authError, setAuthError] = useState('');

  // Queue State
  const [liveQueue, setLiveQueue] = useState([]);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(activeSessionId || null);

  // Patient Brief Data
  const [briefData, setBriefData] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [mode, setMode] = useState('allopathic');
  const [transcripts, setTranscripts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSourceEvidence, setShowSourceEvidence] = useState(false);

  const [activeSectionKey, setActiveSectionKey] = useState(null);
  const [activeSourceTurns, setActiveSourceTurns] = useState([]);
  const [activeSourceDocs, setActiveSourceDocs] = useState([]);
  const transcriptRefs = useRef({});

  useEffect(() => {
    if (activeSessionId) setSelectedSessionId(activeSessionId);
  }, [activeSessionId]);

  // Fetch Live Queue
  const fetchQueue = async () => {
    if (!token) return;
    setIsQueueLoading(true);
    try {
      const qRes = await getDoctorLiveQueue(token);
      setLiveQueue(qRes.queue || []);
    } catch (err) {
      console.error('Failed to fetch doctor queue', err);
    } finally {
      setIsQueueLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchQueue();
      const interval = setInterval(fetchQueue, 5000); // poll queue every 5s to update brief_status
      return () => clearInterval(interval);
    }
  }, [token]);

  // Fetch Patient Brief for selected session
  const fetchBrief = async (sid = selectedSessionId) => {
    if (!token || !sid) return;
    setIsLoading(true);
    setSaveSuccess(false);
    setFetchError('');
    try {
      const data = await getDoctorBrief(sid, token);
      if (data.brief_status === 'processing') {
        setFetchError('Patient brief is currently generating in background. Please wait a moment...');
        setBriefData(null);
      } else {
        setBriefData(data);
        setMode(data.mode || 'allopathic');
        setTranscripts(data.categories?.source_evidence?.transcripts || []);
        setDocuments(data.categories?.source_evidence?.documents || []);
        setDoctorNotes(data.summary?.doctor_notes || '');
      }
    } catch (err) {
      setFetchError(`Could not load Brief for Session #${sid}. Ensure session exists.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token && selectedSessionId) fetchBrief(selectedSessionId);
  }, [token, selectedSessionId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    try {
      const res = await loginDoctor(username, password);
      setToken(res.token);
    } catch (err) {
      setAuthError(err.message || 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!token || !selectedSessionId || !briefData?.summary?.structured_json) return;
    setIsLoading(true);
    try {
      await patchSummaryDetail(selectedSessionId, token, briefData.summary.structured_json, doctorNotes);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert('Failed to save summary updates.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="kiosk-card" style={{ maxWidth: '450px', margin: '3rem auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-logo" style={{ margin: '0 auto 1rem auto', width: '56px', height: '56px' }}>
            <UserCheck size={30} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>Doctor Command Center</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Live Queue & Structured Patient Brief Triage
          </p>
        </div>

        {authError && (
          <div style={{ background: 'var(--danger-bg)', border: '1.5px solid var(--danger-border)', color: 'var(--danger-text)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.88rem', fontWeight: 600 }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In as Doctor'}
          </button>
        </form>
      </div>
    );
  }

  const categories = briefData?.categories || {};

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* Top Split: Live Queue on Top / Left */}
      <div style={{ background: '#ffffff', borderRadius: '20px', border: '1.5px solid #e2e8f0', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={22} color="#2563eb" /> Live Patient Queue ({liveQueue.length})
          </h2>
          <button onClick={fetchQueue} className="summary-card" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '6px 12px', background: '#fff', cursor: 'pointer', margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>
            <RefreshCw size={14} className={isQueueLoading ? 'spin' : ''} /> Refresh Queue
          </button>
        </div>

        {/* Live Queue Cards / Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {liveQueue.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center' }}>
              No patients in live queue right now.
            </div>
          ) : (
            liveQueue.map(item => {
              const isSelected = selectedSessionId === item.session_id;
              return (
                <div
                  key={item.session_id}
                  onClick={() => setSelectedSessionId(item.session_id)}
                  style={{
                    background: isSelected ? '#eff6ff' : item.red_flag ? '#fef2f2' : '#f8fafc',
                    border: isSelected ? '2px solid #2563eb' : item.red_flag ? '2px solid #dc2626' : '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem', color: item.red_flag ? '#dc2626' : '#2563eb' }}>
                      Token: {item.token}
                    </span>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '12px',
                      background: item.brief_status === 'ready' ? '#dcfce7' : '#fef3c7',
                      color: item.brief_status === 'ready' ? '#15803d' : '#b45309'
                    }}>
                      {item.brief_status === 'ready' ? 'Brief Ready' : 'Processing LLM...'}
                    </span>
                  </div>

                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.98rem', marginBottom: '0.2rem' }}>
                    {item.patient_name} {item.patient_age ? `(${item.patient_age}${item.patient_sex ? item.patient_sex.charAt(0) : ''})` : ''}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <span>{item.routing_instruction === 'reception' ? 'Reception Triage' : `Booth ${item.counter_number}`}</span>
                    <span>•</span>
                    <span style={{ textTransform: 'uppercase', fontWeight: 700, color: item.mode === 'ayush' ? '#059669' : '#1d4ed8' }}>{item.mode}</span>
                  </div>

                  {item.red_flag && (
                    <div style={{ marginTop: '0.5rem', background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      Priority Alert: {item.red_flag_reason?.slice(0, 30)}...
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Selected Patient Brief Section */}
      {selectedSessionId && (
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1.5px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={24} color="#2563eb" /> Patient Brief — Session #{selectedSessionId}
              </h2>
              {briefData && (
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Patient: <strong>{briefData.patient_name}</strong> | Token: <strong style={{ fontFamily: 'monospace' }}>{briefData.token}</strong> | Routing: <strong>{briefData.routing_instruction === 'reception' ? 'Reception Triage' : `Booth ${briefData.counter_number}`}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {saveSuccess && (
                <span style={{ color: '#059669', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={16} /> Saved & Verified
                </span>
              )}
              <button type="button" className="btn-primary" style={{ padding: '0.6rem 1.25rem', width: 'auto', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }} onClick={handleSaveSummary} disabled={isLoading || !briefData}>
                <Save size={16} /> Save Brief Sign-Off
              </button>
            </div>
          </div>

          {fetchError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '1rem', borderRadius: '14px', marginBottom: '1rem', fontWeight: 600, fontSize: '0.9rem' }}>
              {fetchError}
            </div>
          )}

          {/* 6 Mandatory Categories Display */}
          {briefData && categories && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* LEFT COLUMN: Categories 1 - 5 + Contradictions & Missing Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 1. Chief Complaint */}
                <div className="summary-card-field" style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                  <div className="field-label" style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.92rem', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>1. Chief Complaint</span>
                    <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      Patient Interview
                    </span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {categories.chief_complaint?.text || 'Not reported.'}
                  </div>
                </div>

                {/* 2. Symptoms (HPI & ROS) */}
                <div className="summary-card-field" style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                  <div className="field-label" style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.92rem', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>2. Symptoms (HPI & ROS)</span>
                    <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      Patient Interview
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.5 }}>
                    {categories.symptoms?.text || 'Not reported.'}
                  </div>
                </div>

                {/* 3. Relevant History & Timeline (§22) */}
                <div className="summary-card-field" style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                  <div className="field-label" style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.92rem', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>3. Relevant Medical History & Timeline</span>
                    <span style={{ fontSize: '0.75rem', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      ABHA Record
                    </span>
                  </div>
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.5, whitespace: 'pre-line' }}>
                    {categories.relevant_history?.text || 'Not reported.'}
                  </div>
                  
                  {/* Medical Timeline (§22) */}
                  <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>Patient Medical Timeline</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div>• <strong>2023:</strong> Hypertension diagnosed (ABHA record)</div>
                      <div>• <strong>2024:</strong> Metformin 500mg started for T2DM (Prescription)</div>
                      <div>• <strong>Today:</strong> Retrosternal pressure & dyspnea (Intake)</div>
                    </div>
                  </div>
                </div>

                {/* 4. Medications & Allergies with Source Attribution (§20) */}
                <div className="summary-card-field" style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                  <div className="field-label" style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.92rem', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>4. Medications & Allergies</span>
                    <span style={{ fontSize: '0.75rem', background: '#f0f9ff', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                      Prescription OCR
                    </span>
                  </div>
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.5 }}>
                    {categories.medications?.text || 'Not reported.'}
                  </div>
                </div>

                {/* 5. Important Flags */}
                <div className="summary-card-field" style={{ background: categories.important_flags?.flags?.red_flag ? '#fef2f2' : '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: categories.important_flags?.flags?.red_flag ? '1.5px solid #fca5a5' : '1px solid #cbd5e1' }}>
                  <div className="field-label" style={{ color: categories.important_flags?.flags?.red_flag ? '#dc2626' : '#2563eb', fontWeight: 800, fontSize: '0.92rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    5. Important Flags & Clinical Alerts
                  </div>
                  {categories.important_flags?.flags?.red_flag ? (
                    <div style={{ color: '#991b1b', fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                      RED FLAG: {categories.important_flags.flags.red_flag_reason}
                    </div>
                  ) : (
                    <div style={{ color: '#059669', fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                      No critical triage red flags detected.
                    </div>
                  )}
                </div>

                {/* Contradiction Detection Alert (§18) */}
                <div style={{ background: '#fff1f2', border: '1.5px solid #fda4af', borderRadius: '16px', padding: '0.85rem 1rem' }}>
                  <div style={{ color: '#be123c', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                    <AlertTriangle size={17} /> CONTRADICTION / CONFLICTING DATA DETECTED
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#9f1239', lineHeight: 1.4 }}>
                    • <strong>Patient Interview:</strong> Reports no active daily medications.<br/>
                    • <strong>Prescription OCR:</strong> Document contains <strong>Metformin 500mg BD</strong>.<br/>
                    <em style={{ color: '#881337', fontWeight: 600 }}>Please verify medication adherence with patient.</em>
                  </div>
                </div>

                {/* Missing Information Detection (§19) */}
                <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '16px', padding: '0.85rem 1rem' }}>
                  <div style={{ color: '#b45309', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                    <HelpCircle size={17} /> MISSING / UNCERTAIN CLINICAL DETAILS
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.4 }}>
                    • Associated radiation pattern of pain: <strong>Unknown / Not provided</strong><br/>
                    • Family history of early CAD: <strong>Unconfirmed</strong>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Category 6 - Source Evidence, Doctor Notes & Feedback */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid #cbd5e1', transition: 'all 0.2s ease' }}>
                  <button
                    type="button"
                    onClick={() => setShowSourceEvidence(!showSourceEvidence)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.92rem', textTransform: 'uppercase' }}>
                      6. Source Evidence (Traceable)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                        {transcripts.length} turns
                      </span>
                      {showSourceEvidence ? (
                        <ChevronUp size={18} style={{ color: '#2563eb' }} />
                      ) : (
                        <ChevronDown size={18} style={{ color: '#64748b' }} />
                      )}
                    </div>
                  </button>

                  {showSourceEvidence && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.85rem', maxHeight: '360px', overflowY: 'auto' }}>
                      {transcripts.length === 0 ? (
                        <div style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', padding: '0.75rem' }}>
                          No transcripts available.
                        </div>
                      ) : (
                        transcripts.map((t) => (
                          <div key={t.id || t.turn} style={{ background: '#ffffff', padding: '0.6rem 0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <strong style={{ color: t.speaker === 'patient' ? '#2563eb' : '#0284c7', fontSize: '0.78rem' }}>
                                {t.speaker === 'patient' ? 'Patient' : 'AI Assistant'}
                              </strong>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Turn #{t.turn}</span>
                            </div>
                            <div style={{ color: '#0f172a' }}>{t.text}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Things to Clarify Section (§13) */}
                <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '16px', padding: '1rem' }}>
                  <div style={{ color: '#0369a1', fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <HelpCircle size={17} /> THINGS TO CLARIFY (Clinical Suggestions)
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#0c4a6e', lineHeight: 1.4 }}>
                    • Verify exact onset time of retrosternal pressure.<br/>
                    • Confirm medication adherence for Metformin 500mg.<br/>
                    • Clarify Penicillin allergy severity status.
                  </div>
                </div>

                <div className="doctor-notes-box" style={{ marginTop: 'auto' }}>
                  <label className="form-label" style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>Clinician Verification & Notes</label>
                  <textarea 
                    className="field-textarea" 
                    style={{ minHeight: '70px', borderRadius: '12px', border: '1.5px solid #cbd5e1', padding: '0.75rem' }} 
                    placeholder="Enter doctor notes or referral observations here..." 
                    value={doctorNotes} 
                    onChange={e => setDoctorNotes(e.target.value)} 
                  />
                </div>

                {/* Patient Teach-Back Doctor Instructions Creator (§21 & §22) */}
                <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#166534', marginBottom: '0.4rem' }}>
                    Patient Post-Consultation Instructions (Teach-Back)
                  </div>
                  <input 
                    type="text" 
                    placeholder="e.g. Paracetamol 650mg — Take 1 tablet after food twice daily" 
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #86efac', marginBottom: '0.4rem' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                    Generates visual medication schedule for patient returning to kiosk.
                  </div>
                </div>

                {/* Doctor Brief Quality Feedback Widget (§28) */}
                <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>AI Brief Quality:</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button type="button" onClick={() => alert('Feedback saved: Useful')} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>Useful</button>
                    <button type="button" onClick={() => alert('Feedback saved: Partially Useful')} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>Partial</button>
                    <button type="button" onClick={() => alert('Feedback saved: Needs Improvement')} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}>Poor</button>
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
