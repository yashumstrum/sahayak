import random
import string
import threading
import uuid
from django.contrib.auth import authenticate
from django.db.models import Max
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ABDMPushLog, ClinicalFlag, ConsentRecord, Document, LinkedRecord, Patient, Session, Summary, Transcript
from .serializers import (
    ABDMPushLogSerializer, AbdmAuthSerializer, AssistedModeSerializer, ClinicalFlagSerializer,
    ConsentRecordSerializer, ConsentRevokeSerializer, ConsentSerializer, DocumentSerializer,
    IdentifySerializer, LinkedRecordSerializer, LoginSerializer, RedFlagSerializer,
    RespondSerializer, SessionIdSerializer, StartInterviewSerializer, SummaryPatchSerializer,
    SummarySerializer, TokenGenerateSerializer, TokenValidateSerializer, TranscriptSerializer,
    UploadDocumentSerializer
)
from .services import abdm, clinical_checks, drug_interactions, llm, ocr, redflag_rules


def _session(pk):
    try: return Session.objects.get(pk=pk)
    except Session.DoesNotExist: return None

def _next_turn(session):
    return (session.transcripts.aggregate(maximum=Max("turn"))["maximum"] or 0) + 1

def _history(session):
    return [{"turn": t.turn, "speaker": t.speaker, "text": t.text, "dimension_asked": t.dimension_asked} for t in session.transcripts.all()]


def _execute_summary_generation(session):
    """Combines interview transcript, linked ABHA records, and prescription OCR data into a structured clinical summary."""
    documents = [{"id": d.id, "fields": d.extracted_fields, "text": d.extracted_text} for d in session.documents.all()]

    # Inject mock / database LinkedRecord items
    for lr in session.linked_records.all():
        documents.append({
            "id": f"LINKED-REC-{lr.id}",
            "text": f"Linked Record ({lr.title}): {lr.details}",
            "fields": lr.details
        })

    # ABDM fallback injection for Meera Devi demo if abha_id or abha_number matches
    abha = session.patient.abha_number or session.patient.abha_id or ""
    abha_clean = abha.replace("-", "").replace(" ", "")
    if session.patient.abha_id == "MOCK-MEERA-001" or abha_clean == "91123456789012":
        if not any(d.get("id") == "ABDM-PHR-RECORD" for d in documents):
            documents.append({
                "id": "ABDM-PHR-RECORD",
                "text": (
                    "ABDM Personal Health Record: \n"
                    "PMH: Type 2 Diabetes Mellitus (diagnosed ~5 years ago), Hypertension (High BP, diagnosed ~3 years ago). "
                    "Current Medications: Metformin 500mg twice daily, Enalapril 5mg once daily. "
                    "Drug Allergy: Penicillin (develops skin rash). "
                    "Family History: Father had a heart attack at age 60, Mother has Type 2 Diabetes. "
                    "Personal/Lifestyle History: Vegetarian, moderately oily/spicy home-cooked food. Sedentary most of the day; no regular exercise. "
                    "Sleeps ~6 hours a night, occasionally disturbed. Never smoked, does not drink. Moderate stress (financial worry, caring for grandchildren)."
                ),
                "fields": {}
            })

    structured = llm.generate_summary(_history(session), documents, mode=session.mode)
    Summary.objects.update_or_create(session=session, defaults={"structured_json": structured})
    session.status = Session.Status.SUMMARY_READY
    session.save(update_fields=["status", "updated_at"])
    return structured


def _async_generate_summary(session_id):
    """Background async summary generator."""
    try:
        session = Session.objects.get(pk=session_id)
        _execute_summary_generation(session)
    except Exception as e:
        print(f"Async summary generation error for session {session_id}: {e}")


class IdentifyView(APIView):
    """
    POST /api/identify/
    Handles the ABHA YES vs NO identification fork (§2b).
    - YES: fetches/populates mock linked health records for session.
    - NO: collects basic registration fields (name, age, sex), no linked records exist.
    """
    def post(self, request):
        form = IdentifySerializer(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data

        has_abha = data["has_abha"]
        abha_id = data.get("abha_id")
        basic_info = data.get("basic_info") or {}
        lang = data.get("language", "en")
        mode = data.get("mode", "allopathic")

        if has_abha:
            abha_str = abha_id or f"MOCK-{uuid.uuid4().hex[:8].upper()}"
            patient_name = basic_info.get("name") or ("Meera Devi" if abha_str == "MOCK-MEERA-001" else "ABHA Patient")
            age = basic_info.get("age") or (52 if abha_str == "MOCK-MEERA-001" else 45)
            sex = basic_info.get("sex") or ("Female" if abha_str == "MOCK-MEERA-001" else "Female")

            patient = Patient.objects.filter(abha_id=abha_str).first()
            if not patient:
                patient = Patient.objects.create(
                    abha_id=abha_str,
                    name=patient_name,
                    age=age,
                    sex=sex,
                    language=lang,
                    preferred_language=lang
                )
            else:
                patient.language = lang
                patient.preferred_language = lang
                patient.save()
            session = Session.objects.create(patient=patient, mode=mode)

            # Seed mock linked records for ABHA path
            LinkedRecord.objects.get_or_create(
                session=session,
                title="ABDM Health Record: Past History & Medications",
                defaults={
                    "record_type": "past_medical_history",
                    "details": {
                        "pmh": "Type 2 Diabetes Mellitus (5 yrs), Hypertension (3 yrs)",
                        "current_medications": ["Metformin 500mg BD", "Enalapril 5mg OD"],
                        "drug_allergies": ["Penicillin (skin rash)"]
                    },
                    "date": "2025-06-15"
                }
            )
            LinkedRecord.objects.get_or_create(
                session=session,
                title="ABDM Health Record: Family & Lifestyle History",
                defaults={
                    "record_type": "family_lifestyle",
                    "details": {
                        "family_history": "Father: Myocardial infarction at 60. Mother: T2DM.",
                        "lifestyle": "Vegetarian diet, non-smoker, non-drinker, mild stress."
                    },
                    "date": "2025-06-15"
                }
            )
        else:
            patient_name = basic_info.get("name") or "Anonymous Patient"
            age = basic_info.get("age")
            sex = basic_info.get("sex")
            patient = Patient.objects.create(
                name=patient_name,
                age=age,
                sex=sex,
                language=lang,
                preferred_language=lang
            )
            session = Session.objects.create(patient=patient, mode=mode)
            # No linked records in no-ABHA path

        # Single explicit intake consent record
        ConsentRecord.objects.create(
            session=session,
            scope={"intake_interview": True, "ocr_scanning": True, "abdm_sharing": True}
        )

        return Response({
            "session_id": session.id,
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "sex": patient.sex,
                "abha_id": patient.abha_id,
                "has_abha": has_abha,
            },
            "has_abha": has_abha,
            "linked_records_count": session.linked_records.count(),
            "linked_records": LinkedRecordSerializer(session.linked_records.all(), many=True).data,
            "message": "Patient identified successfully"
        }, status=201)


class InterviewStartView(APIView):
    def post(self, request):
        form = StartInterviewSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data

        session_id = data.get("session_id")
        if session_id:
            session = _session(session_id)
            if not session:
                return Response({"detail": "Session not found."}, status=404)
        else:
            patient_name = data.get("patient_name") or "Anonymous Patient"
            patient, _ = Patient.objects.get_or_create(
                name=patient_name,
                language=data["language"],
                defaults={"abha_id": data.get("abha_id"), "abha_number": data.get("abha_number"), "preferred_language": data["language"]}
            )
            session = Session.objects.create(patient=patient, mode=data.get("mode", "allopathic"))
            ConsentRecord.objects.create(
                session=session,
                scope={"intake_interview": True, "ocr_scanning": True, "abdm_sharing": True}
            )

        # Check if first question turn already exists
        first_turn = session.transcripts.filter(speaker="ai", turn=1).first()
        if first_turn:
            text = first_turn.text
            chips = ["Headache", "Fever", "Chest pain", "Cough & Cold"]
        else:
            question = llm.get_first_question(mode=session.mode, language=session.patient.language)
            text = question.get("question", "What brings you in today?")
            chips = question.get("chips", [])
            Transcript.objects.create(session=session, turn=1, speaker="ai", text=text, language=data["language"], dimension_asked=question.get("dimension"))

        return Response({
            "session_id": session.id,
            "mode": session.mode,
            "question": text,
            "chips": chips,
            "escape_hatch": "Something else / not sure",
            "input_type": "options",
            "selection_mode": "single"
        }, status=201)


class AssistedModeView(APIView):
    """
    POST /api/interview/assisted/
    Flags session as requiring staff assistance (§2d).
    Staff can take over and submit answers on patient's behalf.
    """
    def post(self, request):
        form = AssistedModeSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        session = _session(form.validated_data["session_id"])
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        session.assisted_mode = form.validated_data["assisted"]
        session.save(update_fields=["assisted_mode", "updated_at"])
        return Response({
            "session_id": session.id,
            "assisted_mode": session.assisted_mode,
            "message": "Assisted mode updated successfully."
        })


class InterviewRespondView(APIView):
    def post(self, request):
        form = RespondSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data

        session = _session(data["session_id"])
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        Transcript.objects.create(
            session=session,
            turn=_next_turn(session),
            speaker="patient",
            text=data["answer"],
            input_mode=data["input_mode"],
            language=data.get("language", session.patient.language)
        )

        flag = redflag_rules.check(data["answer"], _history(session))
        if flag["flagged"]:
            session.red_flag = True
            session.red_flag_reason = flag["reason"]
            if flag.get("severity") == "critical" or session.red_flag_severity != "critical":
                session.red_flag_severity = flag.get("severity") or "moderate"

        next_item = llm.get_next_question(_history(session), mode=session.mode, language=session.patient.language)

        if next_item.get("done"):
            session.status = Session.Status.AWAITING_SUMMARY
            session.save()
            return Response({
                "question": None,
                "chips": [],
                "escape_hatch": None,
                "input_type": None,
                "done": True,
                "needs_clarification": False,
                "red_flag": session.red_flag,
                "red_flag_reason": session.red_flag_reason
            })

        text = next_item.get("question") or "Could you describe when this started and how severe it is?"
        if next_item.get("needs_clarification") and not session.needed_clarification:
            session.needed_clarification = True
        Transcript.objects.create(session=session, turn=_next_turn(session), speaker="ai", text=text, dimension_asked=next_item.get("dimension"))
        session.save()

        return Response({
            "question": text,
            "chips": next_item.get("chips", []),
            "escape_hatch": next_item.get("escape_hatch"),
            "input_type": next_item.get("input_type", "options"),
            "selection_mode": next_item.get("selection_mode", "single"),
            "done": False,
            "needs_clarification": next_item.get("needs_clarification", False),
            "red_flag": session.red_flag,
            "red_flag_reason": session.red_flag_reason
        })


class DocumentUploadView(APIView):
    def post(self, request):
        form = UploadDocumentSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data

        session = _session(data["session_id"])
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        result = ocr.extract(data["image"], session=session)
        doc = Document.objects.create(
            session=session,
            image=data["image"],
            extracted_text=result["extracted_text"],
            extracted_fields=result["fields"],
            confidence=result["confidence"],
            ocr_method=result.get("ocr_method", "printed")
        )

        flags = clinical_checks.analyze_document_fields(session, doc, doc.extracted_fields)
        medicines = doc.extracted_fields.get("medicines", []) or []
        interaction_alerts = drug_interactions.check_interactions(medicines)

        return Response({
            "document_id": doc.id,
            "extracted_text": doc.extracted_text,
            "fields": doc.extracted_fields,
            "confidence": doc.confidence,
            "ocr_method": doc.ocr_method,
            "clinical_flags": ClinicalFlagSerializer(flags, many=True).data,
            "interaction_alerts": interaction_alerts,
        }, status=201)


class SummaryGenerateView(APIView):
    def post(self, request):
        form = SessionIdSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        session = _session(form.validated_data["session_id"])
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        structured = _execute_summary_generation(session)
        return Response(structured)


class SummaryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = _session(session_id)
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        try: summary = session.summary
        except Summary.DoesNotExist: return Response({"detail": "Summary not found."}, status=404)

        return Response({
            "mode": session.mode,
            "summary": SummarySerializer(summary).data,
            "transcripts": TranscriptSerializer(session.transcripts.all(), many=True).data,
            "documents": DocumentSerializer(session.documents.all(), many=True).data,
            "clinical_flags": ClinicalFlagSerializer(session.clinical_flags.all(), many=True).data,
            "consent_records": ConsentRecordSerializer(session.consent_records.all(), many=True).data,
            "abdm_logs": ABDMPushLogSerializer(session.abdm_push_logs.all(), many=True).data
        })

    def patch(self, request, session_id):
        session = _session(session_id)
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        try: summary = session.summary
        except Summary.DoesNotExist: return Response({"detail": "Summary not found."}, status=404)

        form = SummaryPatchSerializer(data=request.data)
        form.is_valid(raise_exception=True)

        summary.structured_json = form.validated_data["structured_json"]
        if "doctor_notes" in form.validated_data:
            summary.doctor_notes = form.validated_data["doctor_notes"]
        summary.edited_by_doctor = True
        summary.save()

        session.status = Session.Status.DOCTOR_REVIEWED
        session.save(update_fields=["status", "updated_at"])
        return Response(SummarySerializer(summary).data)


class RedFlagCheckView(APIView):
    def post(self, request):
        form = RedFlagSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        return Response(redflag_rules.check(form.validated_data["text"]))


class ConsentGrantView(APIView):
    def post(self, request):
        form = ConsentSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        session = _session(form.validated_data["session_id"])
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        rec = ConsentRecord.objects.create(session=session, scope=form.validated_data["scope"])
        return Response(ConsentRecordSerializer(rec).data, status=201)


class ConsentRevokeView(APIView):
    def post(self, request):
        form = ConsentRevokeSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        try:
            rec = ConsentRecord.objects.get(pk=form.validated_data["consent_id"])
        except ConsentRecord.DoesNotExist:
            return Response({"detail": "Consent record not found."}, status=404)

        rec.revoked_at = timezone.now()
        rec.save(update_fields=["revoked_at"])
        return Response(ConsentRecordSerializer(rec).data)


class AbdmAuthView(APIView):
    def post(self, request):
        form = AbdmAuthSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        number = form.validated_data["abha_number"]
        clean_number = number.replace("-", "").replace(" ", "")
        if clean_number == "91123456789012":
            return Response({
                "status": "authenticated",
                "abha_number": "91-1234-5678-9012",
                "abha_id": "MOCK-MEERA-001",
                "patient_name": "Meera Devi",
                "language": "hi",
                "txn_id": uuid.uuid4().hex
            })

        return Response({
            "status": "authenticated",
            "abha_number": number,
            "abha_id": f"MOCK-{uuid.uuid4().hex[:8].upper()}",
            "txn_id": uuid.uuid4().hex
        })


class MockAbdmPushView(APIView):
    def post(self, request):
        form = SessionIdSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        session = _session(form.validated_data["session_id"])
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        result = abdm.push_to_abdm(session)
        return Response(result)


class LoginView(APIView):
    def post(self, request):
        form = LoginSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        user = authenticate(username=form.validated_data["username"], password=form.validated_data["password"])
        if not user:
            return Response({"detail": "Invalid credentials."}, status=400)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key})


def _generate_token_str():
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        candidate = "".join(random.choices(chars, k=6))
        if not Session.objects.filter(token=candidate).exists():
            return candidate
    raise ValueError("Could not generate unique token after 20 attempts")


COUNTER_COUNT = 3


def _assign_counter():
    today_token_count = Session.objects.filter(
        token_generated_at__date=timezone.now().date()
    ).exclude(token__isnull=True).count()
    return (today_token_count % COUNTER_COUNT) + 1


class TokenGenerateView(APIView):
    """
    POST /api/token/generate/
    Decoupled token generation (§2e & §2f).
    Generates token immediately and returns to patient.
    Triggers summary generation asynchronously in the background.
    """
    def post(self, request):
        form = TokenGenerateSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        session = _session(form.validated_data["session_id"])
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        now = timezone.now()

        # Red alert routing check
        if session.red_flag:
            routing_instruction = "reception"
            counter_number = None
            message = "Visit Reception — staff will guide you to the doctor"
        else:
            routing_instruction = "direct_booth"
            counter_number = session.counter_number or _assign_counter()
            message = f"Go to Doctor Booth {counter_number}"

        if not session.token:
            session.token = _generate_token_str()
            session.token_status = Session.TokenStatus.PENDING
            session.token_generated_at = now
            session.token_expires_at = now + timezone.timedelta(minutes=15)
            session.counter_number = counter_number
            if session.status == Session.Status.IN_PROGRESS:
                session.status = Session.Status.AWAITING_SUMMARY
            session.save(update_fields=[
                "token", "token_status", "token_generated_at", "token_expires_at",
                "counter_number", "status", "updated_at"
            ])

        # Asynchronous background summary generation
        if session.status in (Session.Status.IN_PROGRESS, Session.Status.AWAITING_SUMMARY) and not hasattr(session, "summary"):
            threading.Thread(target=_async_generate_summary, args=(session.id,), daemon=True).start()

        return Response({
            "token": session.token,
            "counter_number": session.counter_number,
            "routing_instruction": routing_instruction,
            "message": message,
            "priority": session.red_flag,
            "expires_at": session.token_expires_at,
        })


class DoctorQueueView(APIView):
    """
    GET /api/doctor/queue/
    Returns live doctor queue of patients with issued tokens (§2g).
    Indicates brief_status ("processing" | "ready").
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        sessions = Session.objects.filter(
            created_at__date=today,
            token__isnull=False
        ).order_by("-red_flag", "created_at")

        queue = []
        for s in sessions:
            brief_status = "ready" if (hasattr(s, "summary") and s.status in [Session.Status.SUMMARY_READY, Session.Status.DOCTOR_REVIEWED]) else "processing"
            routing = "reception" if s.red_flag else "direct_booth"
            queue.append({
                "session_id": s.id,
                "token": s.token,
                "token_status": s.token_status,
                "patient_name": s.patient.name,
                "patient_age": s.patient.age,
                "patient_sex": s.patient.sex,
                "has_abha": bool(s.patient.abha_id),
                "abha_id": s.patient.abha_id,
                "mode": s.mode,
                "red_flag": s.red_flag,
                "red_flag_reason": s.red_flag_reason or "",
                "red_flag_severity": s.red_flag_severity or "",
                "routing_instruction": routing,
                "counter_number": s.counter_number,
                "brief_status": brief_status,
                "assisted_mode": s.assisted_mode,
                "created_at": s.created_at.isoformat(),
            })

        return Response({"queue": queue})


class DoctorBriefView(APIView):
    """
    GET /api/doctor/brief/<int:session_id>/
    Doctor Patient Brief (§2h) showing the 6 mandatory categories:
    Chief complaint, Symptoms, Relevant history, Medications, Important flags, Source evidence.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = _session(session_id)
        if not session:
            return Response({"detail": "Session not found."}, status=404)

        if not hasattr(session, "summary"):
            return Response({
                "session_id": session.id,
                "brief_status": "processing",
                "message": "Clinical brief is currently generating in the background."
            }, status=202)

        sj = session.summary.structured_json or {}

        # 1. Chief Complaint
        cc = sj.get("chief_complaint", {})

        # 2. Symptoms (HPI & ROS)
        hpi = sj.get("hpi", {})
        ros = sj.get("ros", {})
        symptoms_text = hpi.get("text", "")
        if ros.get("text") and ros.get("text") != "Not reported.":
            symptoms_text += f"\nReview of Systems: {ros.get('text')}"

        # 3. Relevant History
        pmh = sj.get("pmh", {}).get("text", "")
        fam = sj.get("family_history", {}).get("text", "")
        personal = sj.get("personal_history", {}).get("text", "")
        history_text = f"PMH: {pmh}\nFamily History: {fam}\nLifestyle/Personal: {personal}"
        linked_records_data = LinkedRecordSerializer(session.linked_records.all(), many=True).data

        # 4. Medications
        meds_text = sj.get("drug_allergy", {}).get("text", "")
        ocr_meds = []
        for doc in session.documents.all():
            m_list = doc.extracted_fields.get("medicines", [])
            if m_list:
                ocr_meds.extend(m_list)

        # 5. Important Flags
        clinical_flags = ClinicalFlagSerializer(session.clinical_flags.all(), many=True).data
        interaction_alerts = []
        for doc in session.documents.all():
            meds = doc.extracted_fields.get("medicines", []) or []
            if meds:
                interaction_alerts.extend(drug_interactions.check_interactions(meds))

        important_flags = {
            "red_flag": session.red_flag,
            "red_flag_reason": session.red_flag_reason or "",
            "red_flag_severity": session.red_flag_severity or "",
            "clinical_flags": clinical_flags,
            "interaction_alerts": interaction_alerts,
        }

        # 6. Source Evidence
        transcripts = TranscriptSerializer(session.transcripts.all(), many=True).data
        documents = DocumentSerializer(session.documents.all(), many=True).data

        brief = {
            "session_id": session.id,
            "patient_name": session.patient.name,
            "patient_age": session.patient.age,
            "patient_sex": session.patient.sex,
            "abha_id": session.patient.abha_id,
            "token": session.token,
            "counter_number": session.counter_number,
            "routing_instruction": "reception" if session.red_flag else "direct_booth",
            "brief_status": "ready",
            "mode": session.mode,
            "categories": {
                "chief_complaint": {
                    "title": "Chief Complaint",
                    "text": cc.get("text", "Not reported."),
                    "source_turns": cc.get("source_turns", [])
                },
                "symptoms": {
                    "title": "Symptoms",
                    "text": symptoms_text or "Not reported.",
                    "source_turns": hpi.get("source_turns", [])
                },
                "relevant_history": {
                    "title": "Relevant History",
                    "text": history_text,
                    "linked_records": linked_records_data
                },
                "medications": {
                    "title": "Medications & Allergies",
                    "text": meds_text or "Not reported.",
                    "ocr_extracted_medicines": ocr_meds
                },
                "important_flags": {
                    "title": "Important Flags",
                    "flags": important_flags
                },
                "source_evidence": {
                    "title": "Source Evidence",
                    "transcripts": transcripts,
                    "documents": documents,
                    "linked_records": linked_records_data
                }
            },
            "summary": SummarySerializer(session.summary).data
        }

        return Response(brief)


class TokenLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, token):
        try:
            session = Session.objects.get(token=token)
        except Session.DoesNotExist:
            return Response({"detail": "Token not found."}, status=404)

        chief_complaint = ""
        try:
            sj = session.summary.structured_json
            chief_complaint = sj.get("chief_complaint", {}).get("text", "") or ""
        except (Summary.DoesNotExist, AttributeError):
            pass

        expired = (
            session.token_expires_at is not None
            and timezone.now() > session.token_expires_at
        )

        return Response({
            "session_id": session.id,
            "patient_name": session.patient.name,
            "chief_complaint": chief_complaint,
            "priority": session.red_flag,
            "red_flag_reason": session.red_flag_reason or "",
            "red_flag_severity": session.red_flag_severity or "",
            "counter_number": session.counter_number,
            "needed_clarification": session.needed_clarification,
            "token_status": session.token_status,
            "expired": expired,
        })


class TokenValidateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, token):
        try:
            session = Session.objects.get(token=token)
        except Session.DoesNotExist:
            return Response({"detail": "Token not found."}, status=404)

        form = TokenValidateSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        action = form.validated_data["action"]
        reason = form.validated_data.get("reason", None)

        if action == "approve":
            session.token_status = Session.TokenStatus.APPROVED
            session.rejection_reason = None
        elif action == "reject":
            session.token_status = Session.TokenStatus.REJECTED
            session.rejection_reason = reason

        session.save(update_fields=["token_status", "rejection_reason", "updated_at"])

        return Response({
            "token": session.token,
            "token_status": session.token_status,
            "rejection_reason": session.rejection_reason,
            "session_id": session.id,
            "patient_name": session.patient.name,
        })


class TokenRejectionStatusView(APIView):
    def get(self, request, token):
        try:
            session = Session.objects.get(token=token)
        except Session.DoesNotExist:
            return Response({"detail": "Token not found."}, status=404)

        return Response({
            "token": session.token,
            "token_status": session.token_status,
            "rejection_reason": session.rejection_reason,
        })

