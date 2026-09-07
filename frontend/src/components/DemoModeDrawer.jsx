import React, { useState } from 'react';
import { Play, Sparkles, AlertOctagon, FileText, UserX, HelpCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function DemoModeDrawer({ onRunScenario }) {
  const [isOpen, setIsOpen] = useState(false);

  const scenarios = [
    {
      id: 1,
      title: 'Scenario 1: Normal Patient Journey',
      subtitle: 'ABHA → Prescription OCR → AI Interview → Instant Token → Doctor Booth 3',
      icon: <Sparkles size={16} color="#3b82f6" />,
      action: () => onRunScenario(1)
    },
    {
      id: 2,
      title: 'Scenario 2: No Prescription (Bypass OCR)',
      subtitle: 'Skip OCR scanner completely → Directly to AI Adaptive Interview',
      icon: <FileText size={16} color="#10b981" />,
      action: () => onRunScenario(2)
    },
    {
      id: 3,
      title: 'Scenario 3: No ABHA ID (Basic Registration)',
      subtitle: 'Direct registration (Name, Age, Sex) without ABHA barrier',
      icon: <UserX size={16} color="#f59e0b" />,
      action: () => onRunScenario(3)
    },
    {
      id: 4,
      title: 'Scenario 4: Assisted Mode (Staff Takeover)',
      subtitle: 'Patient understanding assistance & silent Staff Whisper AI suggestions',
      icon: <HelpCircle size={16} color="#8b5cf6" />,
      action: () => onRunScenario(4)
    },
    {
      id: 5,
      title: 'Scenario 5: Red-Alert Escalation',
      subtitle: 'Chest pain detection → Escalated token A-48292 → Reception Triage',
      icon: <AlertOctagon size={16} color="#ef4444" />,
      action: () => onRunScenario(5)
    },
    {
      id: 6,
      title: 'Scenario 6: Clinical Contradiction',
      subtitle: 'Patient reports no meds vs OCR found Metformin 500mg (Flagged for Doctor)',
      icon: <AlertTriangle size={16} color="#ec4899" />,
      action: () => onRunScenario(6)
    },
    {
      id: 7,
      title: 'Scenario 7: Async Brief Processing',
      subtitle: 'Patient gets token immediately while brief populates asynchronously',
      icon: <RefreshCw size={16} color="#06b6d4" />,
      action: () => onRunScenario(7)
    }
  ];

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
      {isOpen ? (
        <div style={{ background: '#0f172a', color: '#f8fafc', borderRadius: '18px', padding: '1.25rem', width: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '1px', fontWeight: 800, color: '#38bdf8' }}>
                🚀 Hackathon Judge Controller
              </span>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '2px 0 0 0' }}>Interactive Demo Scenarios</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: '#334155', border: 'none', color: '#94a3b8', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {scenarios.map(sc => (
              <button
                key={sc.id}
                onClick={() => {
                  sc.action();
                  setIsOpen(false);
                }}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '0.75rem', textAlign: 'left', color: '#fff', cursor: 'pointer', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#38bdf8'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#334155'}
              >
                <div style={{ marginTop: '2px' }}>{sc.icon}</div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{sc.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', lineHeight: '1.3' }}>{sc.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '30px', padding: '10px 20px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 25px rgba(37,99,235,0.4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Play size={16} fill="#fff" /> Launch Demo Scenarios
        </button>
      )}
    </div>
  );
}
