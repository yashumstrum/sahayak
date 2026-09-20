import React, { useState, useEffect } from 'react';
import PatientKiosk from './components/PatientKiosk';
import DoctorCommandCenter from './components/DoctorCommandCenter';
import HospitalAdminPortal from './components/HospitalAdminPortal';
import ReceptionDashboard from './components/ReceptionDashboard';
import { User, Stethoscope, Building2, ArrowRight, HeartPulse, ShieldCheck, AlertCircle, ShieldAlert } from 'lucide-react';

const ALL_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

const HOME_STRINGS = {
  en: {
    langLabel: 'Language:', moreLangs: 'More languages...',
    patient: 'Patient', patientDesc: 'Register, share your symptoms, and review your history.', patientBtn: 'Patient Portal',
    doctor: 'Doctor', doctorDesc: 'Review AI-drafted summaries, manage queue and referrals.', doctorBtn: 'Doctor Access',
    admin: 'Hospital Admin', adminDesc: 'Monitor live queues, analytics, and red-flag alerts.', adminBtn: 'Hospital Admin Portal',
  },
  hi: {
    langLabel: 'भाषा:', moreLangs: 'अधिक भाषाएं...',
    patient: 'रोगी', patientDesc: 'अपने लक्षण दर्ज करें, इतिहास साझा करें और डॉक्टर से मिलने की तैयारी करें।', patientBtn: 'रोगी पोर्टल',
    doctor: 'डॉक्टर', doctorDesc: 'एआई-तैयार सारांश देखें, कतार प्रबंधित करें और रेफ़रल करें।', doctorBtn: 'डॉक्टर एक्सेस',
    admin: 'अस्पताल प्रशासन', adminDesc: 'लाइव कतार, विश्लेषण, और रेड-फ्लैग अलर्ट मॉनिटर करें।', adminBtn: 'प्रशासन पोर्टल',
  },
  mr: {
    langLabel: 'भाषा:', moreLangs: 'अधिक भाषा...',
    patient: 'रुग्ण', patientDesc: 'आपली लक्षणे नोंदवा, इतिहास सामायिक करा आणि डॉक्टरांशी भेटीची तयारी करा.', patientBtn: 'रुग्ण पोर्टल',
    doctor: 'डॉक्टर', doctorDesc: 'एआय-तयार सारांश पाहा, रांग व्यवस्थापित करा आणि रेफरल करा.', doctorBtn: 'डॉक्टर प्रवेश',
    admin: 'रुग्णालय प्रशासन', adminDesc: 'थेट रांग, विश्लेषण आणि रेड-फ्लॅग सतर्कता निरीक्षण करा.', adminBtn: 'प्रशासन पोर्टल',
  },
  ta: {
    langLabel: 'மொழி:', moreLangs: 'மேலும் மொழிகள்...',
    patient: 'நோயாளி', patientDesc: 'உங்கள் அறிகுறிகளை பதிவு செய்யுங்கள், வரலாற்றை பகிர்ந்து மருத்துவரை சந்திக்க தயாராகுங்கள்.', patientBtn: 'நோயாளி போர்டல்',
    doctor: 'மருத்துவர்', doctorDesc: 'AI-வரைவு சுருக்கங்களை மதிப்பாய்வு செய்யுங்கள், வரிசையை நிர்வகியுங்கள்.', doctorBtn: 'மருத்துவர் அணுகல்',
    admin: 'மருத்துவமனை நிர்வாகி', adminDesc: 'நேரடி வரிசைகள், பகுப்பாய்வு மற்றும் சிவப்பு-கொடி எச்சரிக்கைகளை கண்காணிக்கவும்.', adminBtn: 'நிர்வாக போர்டல்',
  },
  te: {
    langLabel: 'భాష:', moreLangs: 'మరిన్ని భాషలు...',
    patient: 'రోగి', patientDesc: 'మీ లక్షణాలు నమోదు చేయండి, చరిత్ర పంచుకోండి మరియు వైద్యుడిని కలవడానికి సిద్ధపడండి.', patientBtn: 'రోగి పోర్టల్',
    doctor: 'వైద్యుడు', doctorDesc: 'AI-రూపొందించిన సారాంశాలు సమీక్షించండి, వరుసను నిర్వహించండి.', doctorBtn: 'వైద్యుడు ప్రవేశం',
    admin: 'ఆసుపత్రి నిర్వాహకుడు', adminDesc: 'నేరుగా వరుసలు, విశ్లేషణ మరియు రెడ్-ఫ్లాగ్ హెచ్చరికలు పర్యవేక్షించండి.', adminBtn: 'నిర్వాహక పోర్టల్',
  },
  bn: {
    langLabel: 'ভাষা:', moreLangs: 'আরও ভাষা...',
    patient: 'রোগী', patientDesc: 'আপনার লক্ষণ নথিভুক্ত করুন, ইতিহাস ভাগ করুন এবং ডাক্তারের সাথে দেখার জন্য প্রস্তুত হন।', patientBtn: 'রোগী পোর্টাল',
    doctor: 'ডাক্তার', doctorDesc: 'AI-খসড়া সারাংশ পর্যালোচনা করুন, সারি পরিচালনা করুন।', doctorBtn: 'ডাক্তার প্রবেশ',
    admin: 'হাসপাতাল প্রশাসন', adminDesc: 'লাইভ সারি, বিশ্লেষণ এবং রেড-ফ্ল্যাগ সতর্কতা পর্যবেক্ষণ করুন।', adminBtn: 'প্রশাসন পোর্টাল',
  },
  kn: {
    langLabel: 'ಭಾಷೆ:', moreLangs: 'ಹೆಚ್ಚಿನ ಭಾಷೆಗಳು...',
    patient: 'ರೋಗಿ', patientDesc: 'ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ನೋಂದಾಯಿಸಿ, ಇತಿಹಾಸ ಹಂಚಿಕೊಳ್ಳಿ ಮತ್ತು ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಲು ಸಿದ್ಧರಾಗಿ.', patientBtn: 'ರೋಗಿ ಪೋರ್ಟಲ್',
    doctor: 'ವೈದ್ಯ', doctorDesc: 'AI-ಸಿದ್ಧಪಡಿಸಿದ ಸಾರಾಂಶಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಸರದಿ ನಿರ್ವಹಿಸಿ.', doctorBtn: 'ವೈದ್ಯ ಪ್ರವೇಶ',
    admin: 'ಆಸ್ಪತ್ರೆ ನಿರ್ವಾಹಕ', adminDesc: 'ನೇರ ಸರದಿಗಳು, ವಿಶ್ಲೇಷಣ ಮತ್ತು ರೆಡ್-ಫ್ಲ್ಯಾಗ್ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಿ.', adminBtn: 'ನಿರ್ವಾಹಕ ಪೋರ್ಟಲ್',
  },
};

export default function App() {
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('sahayak_view');
    return (saved === 'kiosk') ? 'kiosk' : 'home';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordGateMode, setPasswordGateMode] = useState(null); // 'enter_kiosk' | 'exit_kiosk'
  const [lang, setLang] = useState('en');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [fontSize, setFontSize] = useState(16);
  const [highContrast, setHighContrast] = useState(false);
  const [opdCount] = useState({ current: 102, total: 1075 });
  const [showMoreLangs, setShowMoreLangs] = useState(false);

  useEffect(() => {
    if (view !== 'password_gate') {
      localStorage.setItem('sahayak_view', view);
    }
  }, [view]);

  useEffect(() => {
    document.documentElement.style.fontSize = fontSize + 'px';
  }, [fontSize]);

  useEffect(() => {
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [highContrast]);

  const handleEnterKioskClick = () => {
    setPasswordGateMode('enter_kiosk');
    setView('password_gate');
    setPasswordInput('');
    setPasswordError('');
  };

  const mainLangs = ALL_LANGS.slice(0, 3);
  const moreLangs = ALL_LANGS.slice(3);
  const s = HOME_STRINGS[lang] || HOME_STRINGS['en'];

  if (view === 'kiosk') {
    return (
      <div>
        <div style={{ background: '#0f172a', padding: '10px 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', color: '#fff' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
            Sahayak Kiosk Mode Active
          </span>
          <button 
            onClick={() => {
              setPasswordGateMode('exit_kiosk');
              setView('password_gate');
              setPasswordInput('');
              setPasswordError('');
            }} 
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseOver={e => e.target.style.background = '#b91c1c'}
            onMouseOut={e => e.target.style.background = '#dc2626'}
          >
            Exit Patient Portal
          </button>
        </div>
        <header className="app-header">
          <div className="brand-container">
            <div className="brand-logo"><HeartPulse size={24} color="#fff" /></div>
            <div>
              <div className="brand-title">Sahayak</div>
              <div className="brand-subtitle">Smart OPD Pre-Consultation Platform</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '4px 12px', borderRadius: '20px', fontWeight: 700 }}>
              <ShieldCheck size={14} color="#10b981" /><span>ABDM Connected</span>
            </div>
          </div>
        </header>
        <main className="app-container">
          <PatientKiosk activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId} onSessionComplete={() => {}} language={lang} setLanguage={setLang} />
        </main>
      </div>
    );
  }

  if (view === 'doctor') {
    return (
      <div>
        <header className="app-header">
          <div className="brand-container" style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
            <div className="brand-logo"><HeartPulse size={24} color="#fff" /></div>
            <div>
              <div className="brand-title">Sahayak</div>
              <div className="brand-subtitle">Smart OPD Pre-Consultation Platform</div>
            </div>
          </div>
          <button onClick={() => setView('home')} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>← Home</button>
        </header>
        <main className="app-container">
          <DoctorCommandCenter activeSessionId={activeSessionId} />
        </main>
      </div>
    );
  }

    if (view === 'password_gate') {
    return (
      <div className="login-container" style={{ maxWidth: '400px', margin: '8rem auto', padding: '2.5rem', background: '#fff', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
          <HeartPulse size={28} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.45rem', color: '#0f172a' }}>
          {passwordGateMode === 'enter_kiosk' ? 'Lock Kiosk to Patient Portal' : 'Unlock Kiosk / Exit Patient Portal'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
          {passwordGateMode === 'enter_kiosk' ? 'Enter the security password to lock the kiosk into patient mode.' : 'Enter the same password to release the kiosk lock.'}
        </p>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (passwordInput === '1234' || passwordInput === 'admin123' || passwordInput === 'kiosk123') {
            if (passwordGateMode === 'enter_kiosk') {
              setView('kiosk');
            } else {
              setView('home');
            }
          } else {
            setPasswordError('Incorrect password. Please try again.');
          }
        }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Kiosk Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="e.g. 1234" 
              value={passwordInput} 
              onChange={e => setPasswordInput(e.target.value)} 
              autoFocus 
              required 
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Demo Password: <strong>1234</strong>
            </div>
          </div>
          {passwordError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600 }}>
              {passwordError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => {
                if (passwordGateMode === 'exit_kiosk') {
                  setView('kiosk');
                } else {
                  setView('home');
                }
              }} 
              className="summary-card" 
              style={{ flex: 1, padding: '10px', fontSize: '0.88rem', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '12px', background: '#fff', cursor: 'pointer', margin: 0 }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="action-btn" 
              style={{ flex: 1, padding: '10px', fontSize: '0.88rem', fontWeight: 700, background: '#2563eb', border: 'none', color: '#fff', borderRadius: '12px', cursor: 'pointer' }}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'reception') {
    return (
      <div>
        <header className="app-header">
          <div className="brand-container" style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
            <div className="brand-logo" style={{ background: '#dc2626' }}><HeartPulse size={24} color="#fff" /></div>
            <div>
              <div className="brand-title">Sahayak</div>
              <div className="brand-subtitle">Reception Triage & Priority Escalation</div>
            </div>
          </div>
          <button onClick={() => setView('home')} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>← Home</button>
        </header>
        <main className="app-container">
          <ReceptionDashboard />
        </main>
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <div>
        <header className="app-header">
          <div className="brand-container" style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
            <div className="brand-logo"><HeartPulse size={24} color="#fff" /></div>
            <div>
              <div className="brand-title">Sahayak</div>
              <div className="brand-subtitle">Smart OPD Pre-Consultation Platform</div>
            </div>
          </div>
          <button onClick={() => setView('home')} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>← Home</button>
        </header>
        <main className="app-container">
          <HospitalAdminPortal 
            onViewDoctorSession={(sid) => {
              setActiveSessionId(sid);
              setView('doctor');
            }} 
          />
        </main>
      </div>
    );
  }

  // HOME LANDING PAGE
  return (
    <div className="sahayak-root">
      {/* Top nav bar */}
      <header className="sahayak-header">
        <div className="sahayak-brand">
          <span className="sahayak-brand-main">Sahayak</span>
          <span className="sahayak-brand-deva">सहायक</span>
        </div>
      </header>

      {/* Language quick-select row */}
      <div className="sahayak-langbar" style={{ position: 'relative' }}>
        <span className="sahayak-langbar-label">{s.langLabel}</span>
        {mainLangs.map(l => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`sahayak-langbar-btn ${lang === l.code ? 'active' : ''}`}
          >
            {l.label}
          </button>
        ))}
        <button className="sahayak-langbar-btn" onClick={() => setShowMoreLangs(v => !v)}>
          {s.moreLangs}
        </button>
        {showMoreLangs && (
          <div className="sahayak-lang-dropdown" style={{ top: '44px', left: '260px', right: 'auto' }}>
            {moreLangs.map(l => (
              <button key={l.code} onClick={() => { setLang(l.code); setShowMoreLangs(false); }} className={`sahayak-lang-dropdown-item ${lang === l.code ? 'active' : ''}`}>{l.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Portal Cards */}
      <main className="sahayak-main">
        <div className="sahayak-cards">
          {/* Patient Portal */}
          <div className="sahayak-card patient">
            <div className="sahayak-card-icon patient">
              <User size={32} strokeWidth={1.5} />
            </div>
            <h2 className="sahayak-card-title patient">
              {s.patient}
            </h2>
            <p className="sahayak-card-desc">
              {s.patientDesc}
            </p>
            <button className="sahayak-card-btn patient" onClick={handleEnterKioskClick}>
              {s.patientBtn} <ArrowRight size={18} />
            </button>
          </div>

          {/* Doctor Portal */}
          <div className="sahayak-card doctor">
            <div className="sahayak-card-icon doctor">
              <Stethoscope size={32} strokeWidth={1.5} />
            </div>
            <h2 className="sahayak-card-title doctor">
              {s.doctor}
            </h2>
            <p className="sahayak-card-desc">
              {s.doctorDesc}
            </p>
            <button className="sahayak-card-btn doctor" onClick={() => setView('doctor')}>
              {s.doctorBtn} <ArrowRight size={18} />
            </button>
          </div>

          {/* Reception Desk Portal */}
          <div className="sahayak-card admin" style={{ borderColor: '#fca5a5' }}>
            <div className="sahayak-card-icon admin" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <ShieldAlert size={32} strokeWidth={1.5} />
            </div>
            <h2 className="sahayak-card-title admin" style={{ color: '#991b1b' }}>
              Reception Triage
            </h2>
            <p className="sahayak-card-desc">
              Manage red-alert escalations, guide patients, and assign doctor booths.
            </p>
            <button className="sahayak-card-btn admin" style={{ background: '#dc2626', borderColor: '#dc2626' }} onClick={() => setView('reception')}>
              Reception Desk <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="sahayak-footer">
        <div className="sahayak-footer-right">
          <a className="sahayak-footer-link" href="https://www.mohfw.gov.in/" target='_blank' rel='noopener noreferrer'>Ministry of Health</a>
          <span className="sahayak-footer-dot">·</span>
          <span className="sahayak-footer-opd">
            <AlertCircle size={13} />
            OPD Emergency Number: <strong>{opdCount.current} / {opdCount.total}</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
