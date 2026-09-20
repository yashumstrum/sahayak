import React, { useState, useEffect, useRef } from 'react';
import { identifyPatient, startInterview, toggleAssistedMode, respondInterview, uploadDocument, generateToken } from '../api';
import { translations } from '../translations';
import { 
  Mic, MicOff, Send, AlertTriangle, UploadCloud, CheckCircle2, 
  Volume2, VolumeX, ShieldCheck, ArrowRight, Activity, Leaf, ShieldAlert, User, HelpCircle, FileText, Check
} from 'lucide-react';

export default function PatientKiosk({ activeSessionId, setActiveSessionId, onSessionComplete, language, setLanguage }) {
  // Steps:
  // 0: Start Screen
  // 1: Language & Care Stream
  // 2: Consent
  // 3: Identification (ABHA / Basic)
  // 4: Prescription Scan
  // 5: AI Interview
  // 6: Token Ticket
  const [step, setStep] = useState(0);

  const t = (key) => translations[language]?.[key] || translations['en']?.[key] || key;

  // Intake State
  const [mode, setMode] = useState('allopathic'); // 'allopathic' | 'ayush'
  const [hasAbha, setHasAbha] = useState(null); // boolean | null
  const [abhaIdInput, setAbhaIdInput] = useState('');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientSex, setPatientSex] = useState('Female');
  const [linkedRecords, setLinkedRecords] = useState([]);
  
  // Prescription Scan Branch State
  const [hasPrescription, setHasPrescription] = useState(null); // boolean | null
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [clinicalFlags, setClinicalFlags] = useState([]);
  const [interactionAlerts, setInteractionAlerts] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Chat / Interview State
  const [chatHistory, setChatHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [chips, setChips] = useState([]);
  const [inputAnswer, setInputAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assistedModeActive, setAssistedModeActive] = useState(false);

  // Red Flag & Token State
  const [redFlag, setRedFlag] = useState(false);
  const [redFlagReason, setRedFlagReason] = useState('');
  const [tokenData, setTokenData] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Speech Recognition & TTS State
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Spoken Assistant Guidance for Screen Transitions
  useEffect(() => {
    if (!ttsEnabled) return;
    const prompts = {
      0: {
        en: "Welcome to Sahayak. Please tap Start Registration to begin.",
        hi: "सहायक में आपका स्वागत है। शुरू करने के लिए स्टार्ट पर टैप करें।",
      },
      1: {
        en: "Please select your preferred language and care stream.",
        hi: "कृपया अपनी पसंदीदा भाषा और चिकित्सा पद्धति चुनें।",
      },
      2: {
        en: "Please review and confirm your consent to continue.",
        hi: "आगे बढ़ने के लिए कृपया अपनी सहमति दें।",
      },
      3: {
        en: "Do you have an ABHA Health ID?",
        hi: "क्या आपके पास आभा हेल्थ आईडी है?",
      },
      4: {
        en: "Do you have a prescription to scan today?",
        hi: "क्या आज आपके पास कोई पुराना पर्चा है?",
      }
    };

    const msg = prompts[step]?.[language] || prompts[step]?.en;
    if (msg) speakText(msg);
  }, [step, language, ttsEnabled]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputAnswer(transcript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [language]);

  const speakText = (text) => {
    if (!ttsEnabled || !('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        const langMapping = {
          en: 'en-US', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', bn: 'bn-IN', mr: 'mr-IN',
        };
        utterance.lang = langMapping[language] || 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('TTS error:', err);
      }
    }, 150);
  };

  // Step 3: ABHA Identification Submission
  const handleIdentificationSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      let payload = {
        hasAbha: hasAbha,
        language: language,
        mode: mode,
      };

      if (hasAbha) {
        payload.abhaId = abhaIdInput.trim() || "MOCK-MEERA-001";
        payload.basicInfo = { name: patientName.trim() || (abhaIdInput === "MOCK-MEERA-001" ? "Meera Devi" : "ABHA Patient") };
      } else {
        payload.basicInfo = {
          name: aadhaarInput === "123456789012" ? "Meera Devi" : "Patient",
          age: aadhaarInput === "123456789012" ? 52 : 45,
          sex: aadhaarInput === "123456789012" ? "Female" : "Male",
        };
      }

      const res = await identifyPatient(payload);
      setActiveSessionId(res.session_id);
      setPatientName(res.patient.name);
      if (res.patient.age) setPatientAge(res.patient.age);
      if (res.patient.sex) setPatientSex(res.patient.sex);
      setLinkedRecords(res.linked_records || []);

      setToastMessage(res.has_abha ? `ABHA Linked: ${res.patient.name}` : `Registered: ${res.patient.name}`);
      setTimeout(() => setToastMessage(null), 3000);

      setStep(4);
    } catch (err) {
      alert('Failed to register patient. Please check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start AI Interview
  const handleBeginInterview = async () => {
    setIsLoading(true);
    try {
      const data = await startInterview(patientName, language, mode, null, null, activeSessionId);
      setCurrentQuestion(data.question);
      setChips(data.chips || []);
      setChatHistory([{ turn: 1, speaker: 'ai', text: data.question }]);
      setStep(5);
      speakText(data.question);
    } catch (err) {
      alert('Failed to initialize AI interview.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit response during interview
  const submitAnswer = async (answerText, inputModeChoice = 'touch') => {
    if (!answerText.trim() || isLoading) return;

    const userText = answerText.trim();
    setInputAnswer('');
    setIsLoading(true);

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const nextTurnNum = chatHistory.length + 1;
    const updatedHistory = [
      ...chatHistory,
      { turn: nextTurnNum, speaker: 'patient', text: userText, inputMode: inputModeChoice }
    ];
    setChatHistory(updatedHistory);

    try {
      const res = await respondInterview(activeSessionId, userText, inputModeChoice, language);

      if (res.red_flag) {
        setRedFlag(true);
        setRedFlagReason(res.red_flag_reason || 'Emergency symptom detected.');
      }

      if (res.done) {
        await triggerImmediateTokenGeneration();
      } else {
        const aiQuestion = res.question;
        const aiTurnNum = updatedHistory.length + 1;
        setCurrentQuestion(aiQuestion);
        setChips(res.chips || []);
        setChatHistory([
          ...updatedHistory,
          { turn: aiTurnNum, speaker: 'ai', text: aiQuestion }
        ]);
        speakText(aiQuestion);
      }
    } catch (err) {
      alert('Failed to send response to server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Assisted Mode
  const handleRequestHelp = async () => {
    if (!activeSessionId) return;
    try {
      await toggleAssistedMode(activeSessionId, true);
      setAssistedModeActive(true);
      setToastMessage('Staff notified for assistance.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Immediate Token Generation
  const triggerImmediateTokenGeneration = async () => {
    setIsLoading(true);
    try {
      const tokRes = await generateToken(activeSessionId);
      setTokenData(tokRes);
      setStep(6);
    } catch (err) {
      alert('Failed to generate token.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not available. Please type or tap quick replies.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputAnswer('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const docRes = await uploadDocument(activeSessionId, file);
      setUploadedDocs(prev => [...prev, docRes]);
      if (docRes.clinical_flags) setClinicalFlags(prev => [...prev, ...docRes.clinical_flags]);
      if (docRes.interaction_alerts) setInteractionAlerts(prev => [...prev, ...docRes.interaction_alerts]);
    } catch (err) {
      alert('Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetSession = () => {
    if (onSessionComplete) onSessionComplete();
    setActiveSessionId(null);
    setStep(0);
    setHasAbha(null);
    setAbhaIdInput('');
    setPatientName('');
    setPatientAge('');
    setPatientSex('Female');
    setLinkedRecords([]);
    setHasPrescription(null);
    setUploadedDocs([]);
    setClinicalFlags([]);
    setInteractionAlerts([]);
    setChatHistory([]);
    setRedFlag(false);
    setRedFlagReason('');
    setTokenData(null);
    setAssistedModeActive(false);
    setToastMessage(null);
  };

  const languagesList = [
    { code: 'en', label: 'English', sub: 'English' },
    { code: 'hi', label: 'हिंदी', sub: 'Hindi' },
    { code: 'mr', label: 'मराठी', sub: 'Marathi' },
    { code: 'ta', label: 'தமிழ்', sub: 'Tamil' },
    { code: 'te', label: 'తెలుగు', sub: 'Telugu' },
    { code: 'kn', label: 'ಕನ್ನಡ', sub: 'Kannada' },
    { code: 'bn', label: 'বাংলা', sub: 'Bengali' },
  ];

  return (
    <div style={{ maxWidth: '780px', margin: '1.5rem auto', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {toastMessage && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '0.65rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {redFlag && step === 5 && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#991b1b', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
          <strong style={{ display: 'block', fontSize: '0.92rem' }}>Priority Attention Required</strong>
          <span style={{ fontSize: '0.84rem' }}>{redFlagReason || 'Emergency symptom detected. Staff notified for direct assistance.'}</span>
        </div>
      )}

      {/* Clean Minimal Step Indicator */}
      {step > 0 && step < 6 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', gap: '0.5rem', overflowX: 'auto' }}>
          {[
            { num: 1, label: 'Language' },
            { num: 2, label: 'Consent' },
            { num: 3, label: 'Identity' },
            { num: 4, label: 'Documents' },
            { num: 5, label: 'Interview' },
          ].map((sItem) => {
            const isActive = step === sItem.num;
            const isCompleted = step > sItem.num;
            return (
              <div 
                key={sItem.num} 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#2563eb' : isCompleted ? '#059669' : '#94a3b8'
                }}
              >
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  background: isActive ? '#2563eb' : isCompleted ? '#ecfdf5' : '#f1f5f9',
                  color: isActive ? '#ffffff' : isCompleted ? '#059669' : '#64748b'
                }}>
                  {isCompleted ? <Check size={13} /> : sItem.num}
                </span>
                <span>{sItem.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 0: Start Screen */}
      {step === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', border: '1px solid #bfdbfe' }}>
            <Activity size={28} />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
            Sahayak OPD Intake
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '440px', margin: '0 auto 2rem auto', lineHeight: 1.5 }}>
            Prepare your symptoms, medical history, and old prescriptions before meeting the doctor.
          </p>
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{
              padding: '0.85rem 2rem',
              fontSize: '1.05rem',
              fontWeight: 700,
              borderRadius: '12px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>Start Registration</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 1: Language & Care Stream */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              Select Language & Care Stream
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              Choose the language you prefer and the medical consultation system.
            </p>
          </div>

          {/* Language Selection Grid */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>
              Preferred Language
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.65rem' }}>
              {languagesList.map((item) => {
                const isSelected = language === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setLanguage(item.code)}
                    style={{
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '0.75rem 0.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.15rem'
                    }}
                  >
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: isSelected ? '#1e40af' : '#0f172a' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: isSelected ? '#3b82f6' : '#64748b' }}>
                      {item.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Care Stream Selection */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>
              Medical System
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div 
                onClick={() => setMode('allopathic')}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: mode === 'allopathic' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: mode === 'allopathic' ? '#eff6ff' : '#f8fafc'
                }}
              >
                <strong style={{ display: 'block', fontSize: '0.98rem', color: '#0f172a', marginBottom: '0.2rem' }}>Allopathic Care</strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Modern medicine & general physician consultation</span>
              </div>

              <div 
                onClick={() => setMode('ayush')}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: mode === 'ayush' ? '2px solid #059669' : '1px solid #e2e8f0',
                  background: mode === 'ayush' ? '#ecfdf5' : '#f8fafc'
                }}
              >
                <strong style={{ display: 'block', fontSize: '0.98rem', color: '#0f172a', marginBottom: '0.2rem' }}>AYUSH Care</strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Ayurveda, Yoga, Unani, Siddha & Homeopathy</span>
              </div>
            </div>
          </div>

          <button 
            type="button" 
            onClick={() => setStep(2)}
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700, borderRadius: '12px', background: '#2563eb', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span>Continue to Consent</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: Consent */}
      {step === 2 && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              Patient Consent
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              Your data is processed securely under the Digital Personal Data Protection guidelines.
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.75rem', lineHeight: 1.6, fontSize: '0.9rem', color: '#334155' }}>
            {t('dpdp_text_full')}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              type="button" 
              onClick={() => setStep(1)} 
              style={{ flex: 1, padding: '0.8rem', fontSize: '0.95rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '10px', background: '#fff', color: '#475569', cursor: 'pointer' }}
            >
              Back
            </button>
            <button 
              type="button" 
              onClick={() => setStep(3)}
              style={{ flex: 2, padding: '0.8rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '10px', background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <span>I Consent & Continue</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Identification */}
      {step === 3 && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              Patient Identification
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              Link your existing health records or proceed with basic registration.
            </p>
          </div>

          {hasAbha === null && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div
                onClick={() => setHasAbha(true)}
                style={{ padding: '1.5rem 1rem', borderRadius: '14px', border: '2px solid #2563eb', background: '#eff6ff', cursor: 'pointer', textAlign: 'center' }}
              >
                <ShieldCheck size={26} color="#2563eb" style={{ margin: '0 auto 0.5rem auto' }} />
                <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block', marginBottom: '0.2rem' }}>Yes, I have ABHA</strong>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Fetch linked medical history</span>
              </div>

              <div
                onClick={() => setHasAbha(false)}
                style={{ padding: '1.5rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', textAlign: 'center' }}
              >
                <User size={26} color="#64748b" style={{ margin: '0 auto 0.5rem auto' }} />
                <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block', marginBottom: '0.2rem' }}>No ABHA ID</strong>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Register with Aadhaar / Name</span>
              </div>
            </div>
          )}

          {/* ABHA YES Form */}
          {hasAbha === true && (
            <form onSubmit={handleIdentificationSubmit} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ color: '#1e40af', fontSize: '0.95rem' }}>ABHA Number or ID</strong>
                <button type="button" onClick={() => setHasAbha(null)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Change choice</button>
              </div>

              <input 
                type="text" 
                placeholder="e.g. 91-1234-5678-9012" 
                value={abhaIdInput} 
                onChange={e => setAbhaIdInput(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', marginBottom: '1rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Testing demo profile?</span>
                <button 
                  type="button" 
                  onClick={() => { setAbhaIdInput('MOCK-MEERA-001'); setPatientName('Meera Devi'); }}
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Use Demo ABHA
                </button>
              </div>

              <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {isLoading ? 'Retrieving Records...' : 'Retrieve Records & Continue'}
              </button>
            </form>
          )}

          {/* ABHA NO Form */}
          {hasAbha === false && (
            <form onSubmit={handleIdentificationSubmit} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>Aadhaar or Mobile Number</strong>
                <button type="button" onClick={() => setHasAbha(null)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Change choice</button>
              </div>

              <input 
                type="text" 
                placeholder="e.g. 1234 5678 9012" 
                value={aadhaarInput} 
                onChange={e => setAadhaarInput(e.target.value)} 
                required 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', marginBottom: '1rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Testing demo?</span>
                <button 
                  type="button" 
                  onClick={() => { setAadhaarInput('123456789012'); }}
                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Use Demo Aadhaar
                </button>
              </div>

              <button type="submit" disabled={!aadhaarInput.trim() || isLoading} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {isLoading ? 'Saving...' : 'Register & Continue'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* STEP 4: Prescription Scan */}
      {step === 4 && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              Previous Prescriptions
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              Do you have a paper prescription or lab report with you today?
            </p>
          </div>

          {hasPrescription === null && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div
                onClick={() => setHasPrescription(true)}
                style={{ padding: '1.5rem 1rem', borderRadius: '14px', border: '2px solid #2563eb', background: '#eff6ff', cursor: 'pointer', textAlign: 'center' }}
              >
                <UploadCloud size={26} color="#2563eb" style={{ margin: '0 auto 0.5rem auto' }} />
                <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block', marginBottom: '0.2rem' }}>Yes, Scan Document</strong>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Extract medicines & lab values</span>
              </div>

              <div
                onClick={() => { setHasPrescription(false); handleBeginInterview(); }}
                style={{ padding: '1.5rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', textAlign: 'center' }}
              >
                <ArrowRight size={26} color="#059669" style={{ margin: '0 auto 0.5rem auto' }} />
                <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block', marginBottom: '0.2rem' }}>No Documents</strong>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Proceed directly to interview</span>
              </div>
            </div>
          )}

          {hasPrescription === true && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Upload Prescription Image</span>
                <button type="button" onClick={() => setHasPrescription(null)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Change choice</button>
              </div>

              <label style={{ display: 'block', border: '2px dashed #cbd5e1', borderRadius: '14px', padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', marginBottom: '1.25rem' }}>
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                <UploadCloud size={36} color="#2563eb" style={{ margin: '0 auto 0.5rem auto' }} />
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                  {isUploading ? 'Scanning & extracting text...' : 'Click to select prescription image'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  Supports JPG, PNG (Offline OCR extraction)
                </div>
              </label>

              {uploadedDocs.length > 0 && (
                <div style={{ marginBottom: '1.25rem', background: '#f0fdf4', padding: '0.75rem', borderRadius: '10px', border: '1px solid #bbf7d0', fontSize: '0.85rem', color: '#166534' }}>
                  Document scanned successfully ({uploadedDocs.length} attached).
                </div>
              )}

              <button 
                type="button" 
                onClick={handleBeginInterview}
                disabled={isLoading}
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700, borderRadius: '12px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <span>{isLoading ? 'Starting Interview...' : 'Continue to Interview'}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: AI Clinical Interview */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{patientName || 'Patient'}</span>
              <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                {mode.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                type="button" 
                onClick={handleRequestHelp}
                style={{ background: assistedModeActive ? '#fef3c7' : '#f8fafc', border: '1px solid #cbd5e1', color: assistedModeActive ? '#b45309' : '#475569', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {assistedModeActive ? 'Help Requested' : 'Ask for Help'}
              </button>

              <button 
                type="button" 
                onClick={() => setTtsEnabled(!ttsEnabled)}
                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 8px', color: '#475569', cursor: 'pointer' }}
                title="Toggle Voice Speech"
              >
                {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            </div>
          </div>

          {/* Chat History Box */}
          <div style={{ minHeight: '220px', maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
            {chatHistory.map((item, idx) => (
              <div 
                key={idx} 
                style={{
                  alignSelf: item.speaker === 'patient' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: item.speaker === 'patient' ? '#2563eb' : '#f1f5f9',
                  color: item.speaker === 'patient' ? '#ffffff' : '#0f172a',
                  padding: '0.75rem 1rem',
                  borderRadius: item.speaker === 'patient' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  fontSize: '0.92rem',
                  lineHeight: 1.45
                }}
              >
                <div style={{ fontSize: '0.72rem', opacity: 0.8, marginBottom: '0.2rem', fontWeight: 600 }}>
                  {item.speaker === 'patient' ? 'You' : 'Sahayak Assistant'}
                </div>
                <div>{item.text}</div>
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', padding: '0.6rem 1rem', borderRadius: '12px', fontSize: '0.85rem', color: '#64748b' }}>
                Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Symptom Quick Chips */}
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {chips.map((chip, idx) => (
                <button 
                  key={idx} 
                  type="button" 
                  onClick={() => submitAnswer(chip, 'touch')}
                  disabled={isLoading}
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Quick Answers Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {["Yes", "No"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => submitAnswer(opt, 'touch')}
                  disabled={isLoading}
                  style={{
                    background: opt === 'Yes' ? '#ecfdf5' : '#fef2f2',
                    border: opt === 'Yes' ? '1px solid #a7f3d0' : '1px solid #fca5a5',
                    color: opt === 'Yes' ? '#047857' : '#b91c1c',
                    borderRadius: '8px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {opt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => submitAnswer("Skip", 'touch')}
                disabled={isLoading}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Skip
              </button>
            </div>

            {chatHistory.filter(i => i.speaker === 'patient').length >= 1 && (
              <button
                type="button"
                onClick={triggerImmediateTokenGeneration}
                disabled={isLoading}
                style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.9rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Complete & Get Token
              </button>
            )}
          </div>

          {/* Input Row */}
          <form 
            onSubmit={(e) => { e.preventDefault(); submitAnswer(inputAnswer, isListening ? 'voice' : 'touch'); }}
            style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}
          >
            <input 
              type="text" 
              placeholder={isListening ? 'Listening...' : 'Type your reply...'} 
              value={inputAnswer}
              onChange={(e) => setInputAnswer(e.target.value)}
              disabled={isLoading}
              style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.92rem' }}
            />
            <button 
              type="button" 
              onClick={toggleVoiceInput}
              style={{
                background: isListening ? '#dc2626' : '#f1f5f9',
                color: isListening ? '#ffffff' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Voice Input"
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button 
              type="submit" 
              disabled={!inputAnswer.trim() || isLoading}
              style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0 1.25rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* STEP 6: Token Ticket */}
      {step === 6 && tokenData && (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{
            background: tokenData.priority ? '#fef2f2' : '#f8fafc',
            borderRadius: '14px',
            padding: '2rem 1.5rem',
            marginBottom: '1.5rem',
            border: tokenData.priority ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '0.4rem', fontWeight: 700 }}>
              OPD Token Number
            </div>
            
            <div style={{
              fontSize: '3.5rem',
              fontWeight: 900,
              letterSpacing: '4px',
              color: tokenData.priority ? '#dc2626' : '#2563eb',
              marginBottom: '0.75rem',
              fontFamily: 'monospace',
            }}>
              {tokenData.token}
            </div>

            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: tokenData.priority ? '#991b1b' : '#0f172a', marginBottom: '0.4rem' }}>
              {tokenData.message}
            </div>

            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
              Your clinical brief is being prepared for the doctor booth.
            </div>
          </div>

          <button 
            type="button" 
            onClick={handleResetSession} 
            style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700, borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Start Next Patient Intake
          </button>
        </div>
      )}
    </div>
  );
}
