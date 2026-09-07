import React, { useState, useEffect, useRef } from 'react';
import { identifyPatient, startInterview, toggleAssistedMode, respondInterview, uploadDocument, generateToken } from '../api';
import { translations } from '../translations';
import { 
  Mic, MicOff, Send, AlertTriangle, UploadCloud, CheckCircle2, 
  Volume2, VolumeX, ShieldCheck, ArrowRight, Activity, Leaf, ShieldAlert, Sparkles, User, HelpCircle, FileText, Check
} from 'lucide-react';

export default function PatientKiosk({ activeSessionId, setActiveSessionId, onSessionComplete, language, setLanguage }) {
  // Locked Patient Flow Steps:
  // 0: Proximity Wake (Tap "Start")
  // 1: Language & Care Stream Select
  // 2: Consent (Single explicit consent confirmation)
  // 3: ABHA Yes/No Identification Branch
  // 4: Prescription Yes/No OCR Branch
  // 5: AI Interview + Assisted Mode
  // 6: Immediate Token Issuance & Routing
  const [step, setStep] = useState(0);

  // language & setLanguage are lifted to App.jsx so the whole UI reacts to the selection
  const t = (key) => translations[language]?.[key] || translations['en']?.[key] || key;

  // Intake State
  const [mode, setMode] = useState('allopathic'); // 'allopathic' | 'ayush'
  const [hasAbha, setHasAbha] = useState(null); // boolean | null
  const [abhaIdInput, setAbhaIdInput] = useState('');
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
  const [selectionMode, setSelectionMode] = useState('single');
  const [selectedChips, setSelectedChips] = useState([]);
  const [inputAnswer, setInputAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assistedModeActive, setAssistedModeActive] = useState(false);
  const [caregiverModeActive, setCaregiverModeActive] = useState(false);

  // Red Flag & Token State
  const [redFlag, setRedFlag] = useState(false);
  const [redFlagReason, setRedFlagReason] = useState('');
  const [tokenData, setTokenData] = useState(null); // { token, counter_number, routing_instruction, message }
  const [toastMessage, setToastMessage] = useState(null);

  // Speech Recognition & TTS State
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(0.9); // 'normal' | 'slow'
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Spoken Assistant Guidance for Screen Transitions (§2 & §7)
  useEffect(() => {
    if (!ttsEnabled) return;
    const prompts = {
      0: {
        en: "Welcome to Sahayak. I will help you prepare some information before you meet the doctor. Please tap below to begin.",
        hi: "सहायक में आपका स्वागत है। डॉक्टर से मिलने से पहले मैं आपकी जानकारी तैयार करने में मदद करूँगा। शुरू करने के लिए नीचे टैप करें।",
        mr: "सहायक मध्ये आपले स्वागत आहे. मी डॉक्टरांना भेटण्यापूर्वी आपली माहिती तयार करण्यात मदत करेन. सुरू करण्यासाठी खाली टॅप करा.",
        ta: "சஹாயக்கிற்கு நல்வரவு. மருத்துவரை சந்திப்பதற்கு முன் உங்கள் தகவல்களை தயார் செய்ய நான் உதவுவேன்.",
        te: "సహాయక్‌కు స్వాగతం. వైద్యుడిని కలవడానికి ముందు మీ సమాచారాన్ని సిద్ధం చేయడానికి నేను సహాయం చేస్తాను.",
        kn: "ಸಹಾಯಕ್‌ಗೆ ସ୍ୱାଗତ. ವೈದ್ಯರನ್ನು ಭೇಟಿಯಾಗುವ ಮೊದಲು ನಿಮ್ಮ ಮಾಹಿತಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.",
        bn: "সহায়কে স্বাগতম। ডাক্তারের সাথে দেখা করার আগে আমি আপনার তথ্য প্রস্তুত করতে সাহায্য করব।"
      },
      1: {
        en: "Please select the language you would like to speak in.",
        hi: "कृपया वह भाषा चुनें जिसमें आप बात करना चाहते हैं।",
        mr: "कृपया आपण बोलू इच्छित असलेली भाषा निवडा.",
        ta: "நீங்கள் பேச விரும்பும் மொழியைத் தேர்ந்தெடுக்கவும்.",
        te: "దయచేసి మీరు మాట్లాడాలనుకుంటున్న భాషను ఎంచుకోండి.",
        kn: "ದಯವಿಟ್ಟು ನೀವು ಮಾತನಾಡಲು ಬಯಸುವ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
        bn: "আপনি যে ভাষায় কথা বলতে চান তা নির্বাচন করুন।"
      },
      2: {
        en: "Before we continue, I need your consent to process your health information for the doctor.",
        hi: "आगे बढ़ने से पहले, मुझे डॉक्टर के लिए आपकी स्वास्थ्य जानकारी का उपयोग करने के लिए आपकी सहमति चाहिए।",
        mr: "पुढे जाण्यापूर्वी, डॉक्टरांसाठी तुमची आरोग्य माहिती वापरण्यासाठी मला तुमच्या संमतीची गरज आहे.",
        ta: "நாம் തുടருவதற்கு முன், உங்கள் மருத்துவத் தகவலைப் பயன்படுத்த உங்கள் சம்மதம் தேவை.",
        te: "మనం కొనసాగే ముందు, మీ ఆరోగ్య సమాచారాన్ని ఉపయోగించడానికి మీ సమ్మతి అవసరం.",
        kn: "ನಾವು ಮುಂದುವರಿಯುವ ಮೊದಲು, ನಿಮ್ಮ ಆರೋಗ್ಯ ಮಾಹಿತಿಯನ್ನು ಬಳಸಲು ನಿಮ್ಮ ಒಪ್ಪಿಗೆಯ ಅಗತ್ಯವಿದೆ.",
        bn: "আমরা এগিয়ে যাওয়ার আগে, ডাক্তারের জন্য আপনার স্বাস্থ্য তথ্য ব্যবহার করতে আপনার সম্মতির প্রয়োজন।"
      },
      3: {
        en: "Do you have an ABHA Health ID? If yes, tap YES to scan or enter. If not, tap NO to continue.",
        hi: "क्या आपके पास आभा हेल्थ आईडी है? यदि हाँ, तो स्कैन या दर्ज करने के लिए हाँ दबाएँ। यदि नहीं, तो आगे बढ़ने के लिए नहीं दबाएँ।",
        mr: "तुमच्याकडे आभा हेल्थ आयडी आहे का? असल्यास होय वर टॅप करा, नसल्यास नाही वर टॅप करा.",
        ta: "உங்களிடம் ஆபா ஐடி உள்ளதா? ஆம் என்றால் ஆம் என்பதைத் தட்டவும், இல்லை என்றால் இல்லை என்பதைத் தட்டவும்.",
        te: "మీ వద్ద ఆభా ఐడీ ఉందా? ఉంటే అవును అని, లేకపోతే లేదు అని నొక్కండి.",
        kn: "ನಿಮ್ಮ ಬಳಿ ಆಭಾ ಐಡಿ ಇದೆಯೇ? ಇದ್ದರೆ ಹೌದು ಎಂದು, ಇಲ್ಲದಿದ್ದರೆ ಇಲ್ಲ ಎಂದು ಸ್ಪರ್ಶಿಸಿ.",
        bn: "আপনার কি আভা আইডি আছে? থাকলে হ্যাঁ এবং না থাকলে না ট্যাপ করুন।"
      },
      4: {
        en: "Do you have a previous prescription with you today? Tap YES to scan, or NO to skip to the interview.",
        hi: "क्या आज आपके पास कोई पुराना पर्चा है? स्कैन करने के लिए हाँ दबाएँ, या साक्षात्कार पर जाने के लिए नहीं दबाएँ।",
        mr: "तुमच्याकडे जुने प्रिस्क्रिप्शन आहे का? स्कॅन करण्यासाठी होय, किंवा पुढे जाण्यासाठी नाही निवडा.",
        ta: "இன்று உங்களிடம் பழைய மருந்துச் சீட்டு உள்ளதா? ஸ்கேன் செய்ய ஆம், அல்லது தவிர்க்க இல்லை என்பதைத் தேர்ந்தெடுக்கவும்.",
        te: "ఈరోజు మీ వద్ద పాత ప్రిస్క్రిప్షన్ ఉందా? స్కాన్ చేయడానికి అవును, లేదా దాటవేయడానికి లేదు నొక్కండి.",
        kn: "ಇಂದು ನಿಮ್ಮ ಬಳಿ ಹಳೆಯ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಇದೆಯೇ? ಸ್ಕ್ಯಾನ್ ಮಾಡಲು ಹೌದು, ಅಥವಾ ಮುಂದಕ್ಕೆ ಹೋಗಲು ಇಲ್ಲ ಆಯ್ಕೆಮಾಡಿ.",
        bn: "আজ কি আপনার সাথে কোনো পুরনো ব্যবস্থাপত্র আছে? স্ক্যান করতে হ্যাঁ বা সরাসরি যেতে না বেছে নিন।"
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
        window.currentUtterance = utterance;
        
        const langMapping = {
          en: 'en-US', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', bn: 'bn-IN', mr: 'mr-IN',
        };
        utterance.lang = langMapping[language] || 'en-US';

        if (window.speechSynthesis.getVoices) {
          const voices = window.speechSynthesis.getVoices();
          const match = voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(utterance.lang.toLowerCase()));
          if (match) utterance.voice = match;
        }
        
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onend = () => { window.currentUtterance = null; };
        utterance.onerror = () => { window.currentUtterance = null; };
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('TTS execution error:', err);
      }
    }, 200);
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
          name: patientName.trim() || "Rajesh Kumar",
          age: patientAge ? parseInt(patientAge, 10) : 45,
          sex: patientSex,
        };
      }

      const res = await identifyPatient(payload);
      setActiveSessionId(res.session_id);
      setPatientName(res.patient.name);
      if (res.patient.age) setPatientAge(res.patient.age);
      if (res.patient.sex) setPatientSex(res.patient.sex);
      setLinkedRecords(res.linked_records || []);

      if (res.has_abha) {
        setToastMessage(`ABHA Linked: ${res.patient.name} (${res.linked_records_count} records retrieved)`);
      } else {
        setToastMessage(`Patient Registered: ${res.patient.name}`);
      }

      // Proceed to Step 4 (Prescription Choice)
      setStep(4);
    } catch (err) {
      alert('Failed to register patient. Please check backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start AI Interview (called when moving to Step 5)
  const handleBeginInterview = async () => {
    setIsLoading(true);
    try {
      const data = await startInterview(patientName, language, mode, null, null, activeSessionId);
      setCurrentQuestion(data.question);
      setChips(data.chips || []);
      setSelectionMode(data.selection_mode || 'single');
      setSelectedChips([]);
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
        // Interview Completed -> Immediately Generate Token (§0 & §2f)
        await triggerImmediateTokenGeneration();
      } else {
        const aiQuestion = res.question;
        const aiTurnNum = updatedHistory.length + 1;
        setCurrentQuestion(aiQuestion);
        setChips(res.chips || []);
        setSelectionMode(res.selection_mode || 'single');
        setSelectedChips([]);
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

  // Trigger Assisted Mode (§2d)
  const handleRequestHelp = async () => {
    if (!activeSessionId) return;
    try {
      await toggleAssistedMode(activeSessionId, true);
      setAssistedModeActive(true);
      setToastMessage('Assisted Mode Activated! Staff notified to help complete interview.');
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Immediate Token Generation (§2f & §0b)
  const triggerImmediateTokenGeneration = async () => {
    setIsLoading(true);
    try {
      const tokRes = await generateToken(activeSessionId);
      setTokenData(tokRes);
      setStep(6); // Step 6: Token Ticket Display
    } catch (err) {
      alert('Failed to generate token ticket.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Web Speech API is not supported in this browser. Please use Chrome or tap quick replies.');
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

  return (
    <div className="kiosk-card" style={{ maxWidth: '850px', margin: '0 auto', minHeight: '600px' }}>
      {toastMessage && (
        <div className="toast-badge">
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      {redFlag && step === 5 && (
        <div className="red-flag-banner">
          <div className="red-flag-icon">!</div>
          <div>
            <div className="red-flag-title">{t('emergency_alert')}</div>
            <div className="red-flag-desc">{redFlagReason || 'Emergency symptom detected. Priority reception routing activated.'}</div>
          </div>
        </div>
      )}

      {/* Locked Flow Progress Bar */}
      {step > 0 && step < 6 && (
        <div className="step-indicator" style={{ marginBottom: '2rem' }}>
          {[
            { num: 1, key: 'step1_pill', label: 'Language & Stream' },
            { num: 2, key: 'step2_pill', label: 'Consent' },
            { num: 3, key: 'step3_pill', label: 'ABHA ID' },
            { num: 4, key: 'step4_pill', label: 'Document Scan' },
            { num: 5, key: 'step5_pill', label: 'AI Interview' },
          ].map((sItem) => {
            const isActive = step === sItem.num;
            const isCompleted = step > sItem.num;
            return (
              <div 
                key={sItem.num} 
                className={`step-pill ${isActive ? 'active' : isCompleted ? 'completed' : ''}`}
              >
                <span className="step-number">{isCompleted ? '✓' : sItem.num}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 800 : 600 }}>{sItem.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 0: Proximity Sensor Wake Screen (Tap to Start) */}
      {step === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 1.5rem', animation: 'fadeIn 0.4s ease' }}>
          <div style={{
            width: '100px', height: '100px', borderRadius: '30px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem auto', boxShadow: '0 12px 30px rgba(37, 99, 235, 0.35)',
            animation: 'pulse 2.5s infinite'
          }}>
            <Sparkles size={52} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.5rem' }}>
            {t('medikiosk_intake')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 2.5rem auto' }}>
            {t('wake_sub')}
          </p>
          <button
            onClick={() => setStep(1)}
            className="action-btn"
            style={{
              padding: '1.2rem 3rem', fontSize: '1.3rem', fontWeight: 800, borderRadius: '20px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 8px 25px rgba(37, 99, 235, 0.3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.75rem'
            }}
          >
            <span>{t('start_intake_btn')}</span>
            <ArrowRight size={24} />
          </button>
        </div>
      )}

      {/* STEP 1: Welcome + Language + Care Stream Selection */}
      {step === 1 && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
              {t('lang_care_title')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
              {t('lang_care_sub')}
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ fontWeight: 800, margin: 0 }}>{t('preferred_language')}</label>
              <button
                type="button"
                onClick={() => {
                  const newRate = speechRate === 0.9 ? 0.7 : 0.9;
                  setSpeechRate(newRate);
                  setToastMessage(newRate === 0.7 ? 'Speech speed set to Slower (🐢)' : 'Speech speed set to Normal');
                }}
                style={{
                  background: speechRate === 0.7 ? '#fef3c7' : '#f1f5f9',
                  border: speechRate === 0.7 ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                  color: speechRate === 0.7 ? '#92400e' : '#334155',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                {speechRate === 0.7 ? '🐢 Slower Speech' : '⚡ Normal Speed'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
              {[
                { code: 'en', label: 'English', sub: 'English', preview: 'Welcome to Sahayak. You have selected English.' },
                { code: 'hi', label: 'हिंदी', sub: 'Hindi', preview: 'सहायक में आपका स्वागत है। आपने हिंदी चुनी है।' },
                { code: 'mr', label: 'मराठी', sub: 'Marathi', preview: 'सहायक मध्ये आपले स्वागत आहे. आपण मराठी भाषा निवडली आहे.' },
                { code: 'ta', label: 'தமிழ்', sub: 'Tamil', preview: 'சஹாயக்கிற்கு நல்வரவு. நீங்கள் தமிழ் மொழியைத் தேர்ந்தெடுத்துள்ளீர்கள்.' },
                { code: 'te', label: 'తెలుగు', sub: 'Telugu', preview: 'సహాయక్‌కు స్వాగతం. మీరు తెలుగు భాషను ఎంచుకున్నారు.' },
                { code: 'kn', label: 'ಕನ್ನಡ', sub: 'Kannada', preview: 'ಸಹಾಯಕ್‌ಗೆ స్వాಗതം. ನೀವು ಕನ್ನಡ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.' },
                { code: 'bn', label: 'বাংলা', sub: 'Bengali', preview: 'সহায়কে স্বাগতম। আপনি বাংলা ভাষা নির্বাচন করেছেন।' },
              ].map((item) => {
                const isSelected = language === item.code;
                return (
                  <div
                    key={item.code}
                    onClick={() => setLanguage(item.code)}
                    style={{
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      border: isSelected ? '2px solid #1e40af' : '1.5px solid #cbd5e1',
                      borderRadius: '14px',
                      padding: '0.85rem 0.6rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      position: 'relative'
                    }}
                  >
                    <button
                      type="button"
                      title="Listen audio preview"
                      onClick={(e) => {
                        e.stopPropagation();
                        if ('speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          const utt = new SpeechSynthesisUtterance(item.preview);
                          const langMap = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', bn: 'bn-IN' };
                          utt.lang = langMap[item.code] || 'en-US';
                          utt.rate = speechRate;
                          window.speechSynthesis.speak(utt);
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: isSelected ? '#dbeafe' : '#e2e8f0',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: isSelected ? '#1e40af' : '#475569'
                      }}
                    >
                      <Volume2 size={13} />
                    </button>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: isSelected ? '#1e40af' : '#0f172a' }}>
                      🔊 {item.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: isSelected ? '#1e40af' : '#64748b', fontWeight: 600 }}>
                      {item.sub}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">{t('select_care_model')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '0.6rem' }}>
              <div 
                className={`summary-card-field ${mode === 'allopathic' ? 'active-source' : ''}`}
                onClick={() => setMode('allopathic')}
                style={{ padding: '1.25rem', cursor: 'pointer', textAlign: 'center', borderRadius: '20px', background: mode === 'allopathic' ? '#eff6ff' : '#f8fafc', borderColor: mode === 'allopathic' ? '#2563eb' : '#e2e8f0' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem auto' }}>
                  <Activity size={24} />
                </div>
                <strong style={{ color: '#0f172a', display: 'block', fontSize: '1.05rem', fontWeight: 800 }}>{t('mode_allopathic')}</strong>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('allopathic_desc')}</span>
              </div>

              <div 
                className={`summary-card-field ${mode === 'ayush' ? 'active-source' : ''}`}
                onClick={() => setMode('ayush')}
                style={{ padding: '1.25rem', cursor: 'pointer', textAlign: 'center', borderRadius: '20px', background: mode === 'ayush' ? '#ecfdf5' : '#f8fafc', borderColor: mode === 'ayush' ? '#10b981' : '#e2e8f0' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem auto' }}>
                  <Leaf size={24} />
                </div>
                <strong style={{ color: '#0f172a', display: 'block', fontSize: '1.05rem', fontWeight: 800 }}>{t('mode_ayush')}</strong>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('ayush_desc')}</span>
              </div>
            </div>
          </div>

          {/* Caregiver Mode Toggle (§23) */}
          <div style={{ background: caregiverModeActive ? '#eff6ff' : '#f8fafc', border: caregiverModeActive ? '1.5px solid #3b82f6' : '1px solid #cbd5e1', borderRadius: '16px', padding: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <User size={20} color={caregiverModeActive ? '#1d4ed8' : '#2563eb'} />
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0f172a', display: 'block' }}>Caregiver / Family Mode</strong>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {caregiverModeActive ? 'Active — Helper logged in encounter audit trail' : 'Someone is helping me complete intake today'}
                </span>
              </div>
            </div>
            {caregiverModeActive ? (
              <button
                type="button"
                onClick={() => {
                  setCaregiverModeActive(false);
                  setToastMessage('Caregiver Mode Removed');
                }}
                style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '10px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Disable / Remove Caregiver
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCaregiverModeActive(true);
                  setToastMessage('Caregiver Mode Enabled — Helper logged in encounter audit trail.');
                }}
                style={{ background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', borderRadius: '10px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Enable Caregiver Helper
              </button>
            )}
          </div>

          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => setStep(2)}
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: mode === 'ayush' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined }}
          >
            {t('continue_consent_btn')} <ArrowRight size={20} />
          </button>
        </div>
      )}

      {/* STEP 2: Single Explicit Consent Confirmation */}
      {step === 2 && (
        <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: '650px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
              <ShieldCheck size={32} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
              {t('consent_confirm_title')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.2rem' }}>
              {t('consent_confirm_sub')}
            </p>
          </div>

          <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '20px', padding: '1.75rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
            <strong style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              <ShieldCheck size={20} color="#10b981" /> {t('dpdp_title')}
            </strong>
            <p style={{ color: '#334155', fontSize: '0.96rem', margin: 0 }}>
              "{t('dpdp_text_full')}"
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              type="button" 
              className="summary-card" 
              onClick={() => setStep(1)} 
              style={{ flex: 1, padding: '1rem', fontSize: '1rem', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '16px', background: '#fff', cursor: 'pointer', textAlign: 'center' }}
            >
              {t('back')}
            </button>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => setStep(3)}
              style={{ flex: 2, padding: '1rem', fontSize: '1.05rem', background: '#10b981', border: 'none' }}
            >
              {t('i_consent_btn')} <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Identification — ABHA Yes/No Branch */}
      {step === 3 && (
        <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
              {t('patient_id_title')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.2rem' }}>
              {t('patient_id_sub')}
            </p>
          </div>

          {hasAbha === null && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <button
                type="button"
                className="summary-card"
                onClick={() => setHasAbha(true)}
                style={{ padding: '2rem 1.5rem', borderRadius: '20px', border: '2px solid #2563eb', background: '#eff6ff', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                  <ShieldCheck size={28} />
                </div>
                <strong style={{ fontSize: '1.15rem', color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>{t('yes_abha_title')}</strong>
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>{t('yes_abha_sub')}</span>
              </button>

              <button
                type="button"
                className="summary-card"
                onClick={() => setHasAbha(false)}
                style={{ padding: '2rem 1.5rem', borderRadius: '20px', border: '2px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#64748b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                  <User size={28} />
                </div>
                <strong style={{ fontSize: '1.15rem', color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>{t('no_abha_title')}</strong>
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>{t('no_abha_sub')}</span>
              </button>
            </div>
          )}

          {/* ABHA YES Path */}
          {hasAbha === true && (
            <form onSubmit={handleIdentificationSubmit} style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '20px', padding: '1.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ color: '#1e40af', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={20} /> {t('abha_retrieval_header')}
                </strong>
                <button type="button" onClick={() => setHasAbha(null)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>{t('change_choice')}</button>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">{t('enter_abha_label')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. MOCK-MEERA-001 or 91-1234-5678-9012" 
                  value={abhaIdInput} 
                  onChange={e => setAbhaIdInput(e.target.value)} 
                />
              </div>

              {/* Quick Demo Selector */}
              <div style={{ background: '#ffffff', borderRadius: '12px', padding: '0.75rem 1rem', border: '1px solid #93c5fd', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.84rem', color: '#1e3a8a', fontWeight: 600 }}>{t('demo_profile_text')}</span>
                <button 
                  type="button" 
                  onClick={() => { setAbhaIdInput('MOCK-MEERA-001'); setPatientName('Meera Devi'); }}
                  style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('use_demo_abha_btn')}
                </button>
              </div>

              <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%' }}>
                {isLoading ? t('retrieving_records') : t('retrieve_proceed_btn')}
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* ABHA NO Path */}
          {hasAbha === false && (
            <form onSubmit={handleIdentificationSubmit} style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '1.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <strong style={{ color: '#0f172a', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={20} /> {t('basic_reg_header')}
                </strong>
                <button type="button" onClick={() => setHasAbha(null)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>{t('change_choice')}</button>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">{t('patient_full_name')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Rajesh Kumar" 
                  value={patientName} 
                  onChange={e => setPatientName(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('age_years')}</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 45" 
                    value={patientAge} 
                    onChange={e => setPatientAge(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('sex')}</label>
                  <select className="form-select" value={patientSex} onChange={e => setPatientSex(e.target.value)}>
                    <option value="Female">{t('female')}</option>
                    <option value="Male">{t('male')}</option>
                    <option value="Other">{t('other')}</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={!patientName.trim() || isLoading} style={{ width: '100%' }}>
                {isLoading ? t('registering_patient') : t('complete_reg_btn')}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>
      )}

      {/* STEP 4: Prescription Scan Yes/No Branch */}
      {step === 4 && (
        <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
              {t('doc_scan_title')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.2rem' }}>
              {t('doc_scan_sub')}
            </p>
          </div>

          {hasPrescription === null && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <button
                type="button"
                className="summary-card"
                onClick={() => setHasPrescription(true)}
                style={{ padding: '2rem 1.5rem', borderRadius: '20px', border: '2px solid #2563eb', background: '#eff6ff', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                  <UploadCloud size={28} />
                </div>
                <strong style={{ fontSize: '1.15rem', color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>{t('yes_scan_title')}</strong>
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>{t('yes_scan_sub')}</span>
              </button>

              <button
                type="button"
                className="summary-card"
                onClick={() => { setHasPrescription(false); handleBeginInterview(); }}
                style={{ padding: '2rem 1.5rem', borderRadius: '20px', border: '2px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                  <ArrowRight size={28} />
                </div>
                <strong style={{ fontSize: '1.15rem', color: '#0f172a', display: 'block', marginBottom: '0.25rem' }}>{t('no_scan_title')}</strong>
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>{t('no_scan_sub')}</span>
              </button>
            </div>
          )}

          {hasPrescription === true && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('scan_images_sub')}</span>
                <button type="button" onClick={() => setHasPrescription(null)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>{t('change_choice')}</button>
              </div>

              <label className="upload-dropzone">
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                <UploadCloud size={44} color="#2563eb" style={{ margin: '0 auto 0.6rem auto' }} />
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                  {isUploading ? t('upload_scanning') : t('upload_click')}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  {t('upload_formats')}
                </div>
              </label>

              {/* Safety alerts display */}
              {clinicalFlags.length > 0 && (
                <div style={{ background: 'var(--warning-bg)', border: '1.5px solid var(--warning-border)', borderRadius: '16px', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ color: 'var(--warning-text)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem', fontSize: '0.92rem' }}>
                    <ShieldAlert size={18} /> {t('clinical_safety_flags')} ({clinicalFlags.length})
                  </div>
                  {clinicalFlags.map((flag, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', color: '#0f172a', background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #fde68a', marginBottom: '0.35rem' }}>
                      {flag.flag_type === 'abnormal_value' ? (
                        <span>⚠️ <strong>{flag.detail.test_name}:</strong> {flag.detail.value} (Ref: {flag.detail.reference_range})</span>
                      ) : (
                        <span>🚫 <strong>Interaction:</strong> {flag.detail.interacting_pair?.join(' + ')} — {flag.detail.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploadedDocs.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 800 }}>{t('scanned_documents')} ({uploadedDocs.length})</h4>
                  {uploadedDocs.map((doc, i) => (
                    <div key={i} className="ocr-result-card" style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#0f172a' }}>Doc #{doc.document_id} ({doc.ocr_method})</strong> — Confidence: {(doc.confidence * 100).toFixed(0)}%
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleBeginInterview}
                disabled={isLoading}
                style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }}
              >
                {isLoading ? t('starting_interview') : t('continue_interview_btn')}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: AI Interview + Voice Assistant */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Bar: Clean Patient & Status Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '0.85rem 1.25rem',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#ffffff',
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid #cbd5e1'
              }}>
                <User size={16} color="#2563eb" />
                <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: 800 }}>
                  {patientName || 'Patient'} {patientAge ? `(${patientAge}${patientSex.charAt(0)})` : ''}
                </span>
              </div>

              <span style={{
                fontSize: '0.75rem',
                background: mode === 'ayush' ? '#ecfdf5' : '#eff6ff',
                color: mode === 'ayush' ? '#047857' : '#1d4ed8',
                border: mode === 'ayush' ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                padding: '4px 12px',
                borderRadius: '20px',
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}>
                {mode.toUpperCase()} CARE
              </span>

              {assistedModeActive && (
                <span style={{
                  fontSize: '0.75rem',
                  background: '#fffbeb',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <HelpCircle size={13} /> {t('assisted_mode_active')}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button 
                type="button" 
                onClick={handleRequestHelp}
                style={{
                  background: assistedModeActive ? '#fef3c7' : '#ffffff',
                  border: assistedModeActive ? '1.5px solid #d97706' : '1px solid #cbd5e1',
                  color: '#b45309',
                  borderRadius: '14px',
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                }}
              >
                <HelpCircle size={15} />
                <span>{assistedModeActive ? t('help_requested') : t('i_need_help')}</span>
              </button>

              <button 
                type="button" 
                className="tts-toggle" 
                onClick={() => setTtsEnabled(!ttsEnabled)}
                style={{ borderRadius: '14px', padding: '6px 14px', height: 'auto' }}
              >
                {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{ttsEnabled ? t('voice_on') : t('voice_off')}</span>
              </button>
            </div>
          </div>

          {/* Structured Chat Window Box */}
          <div className="chat-container" style={{ height: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="chat-history" style={{ minHeight: '260px', maxHeight: '360px', background: '#ffffff', borderRadius: '20px', border: '1.5px solid #e2e8f0', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.02)' }}>
              {chatHistory.map((item, idx) => (
                <div key={idx} className={`chat-bubble ${item.speaker}`}>
                  <div className="speaker-badge">
                    <span>{item.speaker === 'ai' ? (mode === 'ayush' ? t('ayush_assistant') : t('ai_assistant')) : patientName}</span>
                    <span className="turn-badge">{t('turn_label')} {item.turn}</span>
                  </div>
                  <div>{item.text}</div>
                </div>
              ))}
              {isLoading && (
                <div className="chat-bubble ai" style={{ opacity: 0.7 }}>
                  <em>{t('thinking')}</em>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Assistant Spoken Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => speakText(currentQuestion)}
                  style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}
                >
                  🔊 Repeat
                </button>
                <button
                  type="button"
                  onClick={() => submitAnswer("Could you ask that differently?", "touch")}
                  style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}
                >
                  🔄 Ask differently
                </button>
                <button
                  type="button"
                  onClick={() => {
                    submitAnswer("I don't understand", "touch");
                    handleRequestHelp();
                  }}
                  style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '14px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 800, color: '#92400e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  ❓ I don't understand
                </button>
              </div>

              {chatHistory.filter(i => i.speaker === 'patient').length >= 1 && (
                <button
                  type="button"
                  onClick={triggerImmediateTokenGeneration}
                  disabled={isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '6px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {t('complete_get_token')}
                </button>
              )}
            </div>

            {/* Grouped & Structured Quick Options */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              {/* Row 1: Contextual Symptom Chips */}
              {chips.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>💡 Suggested Answers / Symptoms</span>
                  </div>
                  <div className="chips-container" style={{ margin: 0, gap: '0.5rem' }}>
                    {chips.map((chip, idx) => (
                      <button 
                        key={idx} 
                        type="button" 
                        className="chip-button"
                        onClick={() => submitAnswer(chip, 'touch')}
                        disabled={isLoading}
                        style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#1e40af', borderRadius: '14px', padding: '0.45rem 1rem', fontSize: '0.88rem' }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider if symptoms exist */}
              {chips.length > 0 && <div style={{ height: '1px', background: '#f1f5f9' }} />}

              {/* Row 2: Direct Answers (Yes / No) & Action / Skip Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                
                {/* Direct Yes / No Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.2rem' }}>Answer:</span>
                  {["Yes", "No"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => submitAnswer(opt, 'touch')}
                      disabled={isLoading}
                      style={{
                        background: opt === 'Yes' ? '#ecfdf5' : '#fef2f2',
                        border: opt === 'Yes' ? '1.5px solid #a7f3d0' : '1.5px solid #fca5a5',
                        color: opt === 'Yes' ? '#047857' : '#b91c1c',
                        borderRadius: '12px',
                        padding: '0.4rem 1.1rem',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {opt === 'Yes' ? '✓ Yes' : '✕ No'}
                    </button>
                  ))}
                </div>

                {/* Auxiliary Navigation Controls Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {["I don't know", "Skip", "Prefer not to answer"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => submitAnswer(opt, 'touch')}
                      disabled={isLoading}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        borderRadius: '12px',
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {opt === "I don't know" ? "❓ I don't know" : opt === 'Skip' ? '⏭ Skip' : '🔒 Prefer not to answer'}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Text & Voice Input Bar */}
            <form 
              onSubmit={(e) => { e.preventDefault(); submitAnswer(inputAnswer, isListening ? 'voice' : 'touch'); }}
              className="chat-input-row"
              style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '24px', border: '1.5px solid #cbd5e1', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}
            >
              <input 
                type="text" 
                className="chat-text-input" 
                placeholder={isListening ? t('listening') : t('type_placeholder')} 
                value={inputAnswer}
                onChange={(e) => setInputAnswer(e.target.value)}
                disabled={isLoading}
                style={{ border: 'none', boxShadow: 'none', background: 'transparent' }}
              />
              <button 
                type="button" 
                className={`mic-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleVoiceInput}
                title="Voice Input"
                style={{ width: '44px', height: '44px' }}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button type="submit" className="send-btn" disabled={!inputAnswer.trim() || isLoading} style={{ borderRadius: '18px', padding: '0.75rem 1.4rem' }}>
                <span>{t('send')}</span>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 6: Immediate Token Ticket Display (§0 & §2e & §2f) */}
      {step === 6 && tokenData && (
        <div style={{ textAlign: 'center', animation: 'slideUp 0.4s ease', maxWidth: '600px', margin: '1rem auto' }}>
          <div style={{
            background: tokenData.priority ? '#991b1b' : '#0f172a',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            marginBottom: '1.5rem',
            color: '#ffffff',
            border: tokenData.priority ? '2px solid #ef4444' : '1px solid #334155',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 800 }}>
              {t('your_token')}
            </div>
            
            {/* 6-char Token */}
            <div style={{
              fontSize: '4.2rem',
              fontWeight: 900,
              letterSpacing: '6px',
              color: tokenData.priority ? '#fecaca' : '#38bdf8',
              marginBottom: '1rem',
              fontFamily: 'monospace',
            }}>
              {tokenData.token}
            </div>

            <div style={{ width: '60px', height: '2px', background: 'rgba(255,255,255,0.2)', margin: '0 auto 1.25rem auto' }} />

            {/* Routing Instruction Message */}
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: tokenData.priority ? '#fecaca' : '#4ade80', marginBottom: '0.5rem' }}>
              {tokenData.message}
            </div>

            {tokenData.priority ? (
              <div style={{
                marginTop: '1rem',
                display: 'inline-block',
                background: '#dc2626',
                color: '#fff',
                padding: '0.4rem 1.2rem',
                borderRadius: '999px',
                fontSize: '0.82rem',
                fontWeight: 900,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}>
                {t('priority_reception_badge')}
              </div>
            ) : (
              <div style={{ fontSize: '0.88rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                {t('async_brief_note')} {tokenData.counter_number}.
              </div>
            )}
          </div>

          <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.75rem' }}>
            <CheckCircle2 size={28} color="#10b981" style={{ margin: '0 auto 0.4rem auto' }} />
            <h4 style={{ color: '#065f46', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>{t('intake_complete_title')}</h4>
            <p style={{ color: '#047857', fontSize: '0.88rem', margin: 0 }}>
              You may take your token ticket and proceed as instructed above. Summary brief generation is processing in background.
            </p>
          </div>

          <button type="button" className="btn-primary" onClick={handleResetSession} style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
            {t('start_next')}
          </button>
        </div>
      )}
    </div>
  );
}
