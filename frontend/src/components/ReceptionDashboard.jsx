import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserCheck, ArrowRight, AlertTriangle, Stethoscope, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { getAdminQueue } from '../api';

export default function ReceptionDashboard({ onSelectDoctorBooth }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assignedBooths, setAssignedBooths] = useState({});

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await getAdminQueue();
      if (Array.isArray(data)) {
        setQueue(data);
      } else if (data && data.queue) {
        setQueue(data.queue);
      }
    } catch (err) {
      console.error('Failed to fetch reception queue:', err);
      // Fallback demo queue
      setQueue([
        {
          id: 101,
          token: 'A-48292',
          patient_name: 'Anjali Sharma',
          age: 48,
          sex: 'F',
          mode: 'Allopathic',
          red_flag: true,
          red_flag_reason: 'Severe acute retrosternal chest pressure radiating to left jaw',
          created_at: new Date(Date.now() - 5 * 60000).toISOString(),
          status: 'COMPLETED'
        },
        {
          id: 102,
          token: 'A-48291',
          patient_name: 'Ramesh Patel',
          age: 56,
          sex: 'M',
          mode: 'Allopathic',
          red_flag: false,
          created_at: new Date(Date.now() - 12 * 60000).toISOString(),
          status: 'COMPLETED'
        },
        {
          id: 103,
          token: 'A-48290',
          patient_name: 'Savitri Devi',
          age: 62,
          sex: 'F',
          mode: 'AYUSH',
          red_flag: false,
          created_at: new Date(Date.now() - 18 * 60000).toISOString(),
          status: 'COMPLETED'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAssignBooth = (patientId, boothNumber) => {
    setAssignedBooths(prev => ({
      ...prev,
      [patientId]: boothNumber
    }));
  };

  const priorityPatients = queue.filter(p => p.red_flag || p.priority === 'HIGH');
  const normalPatients = queue.filter(p => !p.red_flag && p.priority !== 'HIGH');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#1e293b', color: '#fff', padding: '1.25rem 1.5rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert color="#ef4444" size={26} /> Reception Triage & Patient Escalation
          </h1>
          <p style={{ margin: '0.3rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Direct red-alert priority cases to emergency triage and guide normal patients to doctor booths
          </p>
        </div>
        <button 
          onClick={fetchQueue}
          style={{ background: '#334155', color: '#f8fafc', border: '1px solid #475569', borderRadius: '10px', padding: '8px 14px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Queue
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Priority Red Alert Column */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '2px solid #fca5a5', padding: '1.25rem', boxShadow: '0 4px 15px rgba(239,68,68,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #fee2e2', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#991b1b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={20} color="#dc2626" /> Red-Alert Priority Escalations ({priorityPatients.length})
            </h2>
            <span style={{ background: '#fef2f2', color: '#991b1b', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid #fca5a5' }}>
              Requires Staff Escort
            </span>
          </div>

          {priorityPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
              No red-alert priority cases at this moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {priorityPatients.map(patient => (
                <div key={patient.id} style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ background: '#ec7070ff', color: '#fff', fontWeight: 900, fontSize: '0.9rem', padding: '4px 10px', borderRadius: '8px', letterSpacing: '0.5px' }}>
                        TOKEN: {patient.token || `A-${patient.id}`}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                        {patient.patient_name || 'Anonymous Patient'} ({patient.age || '--'}{patient.sex || ''})
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} /> {patient.created_at ? new Date(patient.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>

                  <div style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.82rem', color: '#7f1d1d', fontWeight: 600 }}>
                    <strong>Escalation Reason:</strong> {patient.red_flag_reason || 'Safety criteria triggered during AI intake'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      Status: {assignedBooths[patient.id] ? `Directed to ${assignedBooths[patient.id]}` : 'Needs Reception Guidance'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleAssignBooth(patient.id, 'Emergency Booth 1')}
                        style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <UserCheck size={14} /> Escort to Triage
                      </button>
                      <button 
                        onClick={() => handleAssignBooth(patient.id, 'Doctor Booth 1')}
                        style={{ background: '#fff', border: '1px solid #dc2626', color: '#dc2626', borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Assign Booth 1
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Normal Patients Column */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Stethoscope size={20} color="#2563eb" /> Normal Queue Routing ({normalPatients.length})
            </h2>
            <span style={{ background: '#f0f9ff', color: '#0369a1', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', border: '1px solid #bae6fd' }}>
              Auto Booth Assignment
            </span>
          </div>

          {normalPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
              No normal patients waiting at reception.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {normalPatients.map(patient => (
                <div key={patient.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: '0.82rem', padding: '3px 8px', borderRadius: '6px' }}>
                        {patient.token || `A-${patient.id}`}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                        {patient.patient_name || 'Patient'} ({patient.age || '--'}{patient.sex || ''})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Mode: <strong>{patient.mode || 'Allopathic'}</strong> • Intake Complete
                    </div>
                  </div>

                  <div>
                    {assignedBooths[patient.id] ? (
                      <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '4px 10px', borderRadius: '20px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle2 size={13} /> {assignedBooths[patient.id]}
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleAssignBooth(patient.id, 'Doctor Booth 3')}
                        style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '8px', padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        Guide to Booth 3 <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
