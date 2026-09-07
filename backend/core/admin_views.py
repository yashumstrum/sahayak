from django.utils import timezone
from django.db.models import Avg, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Session, Document, Transcript, Summary


class QueueAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get("status")
        
        # Base query: sessions from today
        today = timezone.now().date()
        sessions = Session.objects.filter(created_at__date=today)

        # Apply filtering
        if status_filter == "red_flag":
            sessions = sessions.filter(red_flag=True)
        elif status_filter:
            sessions = sessions.filter(status=status_filter)

        # Sorting: Red-flagged first, then longest waiting first (oldest created_at first)
        sessions = sessions.order_by("-red_flag", "created_at")

        now = timezone.now()
        queue_data = []
        for s in sessions:
            waiting_minutes = int((now - s.created_at).total_seconds() // 60)
            queue_data.append({
                "session_id": s.id,
                "patient_name": s.patient.name,
                "status": s.status,
                "red_flag": s.red_flag,
                "token": s.token,
                "token_status": s.token_status,
                "mode": s.mode,
                "language": s.patient.language,
                "created_at": s.created_at.isoformat(),
                "waiting_minutes": waiting_minutes,
                "needed_clarification": s.needed_clarification,
                "assisted_mode": s.assisted_mode,
            })

        # Base counts for today
        all_today = Session.objects.filter(created_at__date=today)
        counts = {
            "total_today": all_today.count(),
            "pending_review": all_today.filter(status__in=[Session.Status.SUMMARY_READY, Session.Status.AWAITING_SUMMARY]).count(),
            "red_flag_active": all_today.filter(red_flag=True).count(),
            "in_progress": all_today.filter(status=Session.Status.IN_PROGRESS).count(),
        }

        return Response({
            "queue": queue_data,
            "counts": counts
        })


class AlertsAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        red_flagged = Session.objects.filter(
            created_at__date=today,
            red_flag=True
        ).order_by("-updated_at")

        alerts_data = []
        for s in red_flagged:
            alerts_data.append({
                "session_id": s.id,
                "patient_name": s.patient.name,
                "red_flag_reason": s.red_flag_reason,
                "token": s.token,
                "token_status": s.token_status,
                "flagged_at": s.updated_at.isoformat(),
            })

        return Response({
            "alerts": alerts_data
        })


class AnalyticsAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        sessions = Session.objects.filter(created_at__date=today)
        total_sessions = sessions.count()

        # 1. Complaint breakdown
        complaint_breakdown = {}
        for s in sessions:
            complaint = None
            try:
                if hasattr(s, "summary") and s.summary:
                    complaint = s.summary.structured_json.get("chief_complaint", {}).get("text", "")
            except Summary.DoesNotExist:
                pass

            if not complaint:
                first_pt_turn = s.transcripts.filter(speaker="patient").order_by("turn").first()
                if first_pt_turn:
                    complaint = first_pt_turn.text

            if complaint:
                c_clean = complaint.strip().lower()
                if "fever" in c_clean or "बुखार" in c_clean:
                    c_norm = "fever"
                elif "cough" in c_clean or "खांसी" in c_clean:
                    c_norm = "cough"
                elif "chest pain" in c_clean or "सीने में दर्द" in c_clean:
                    c_norm = "chest pain"
                elif "headache" in c_clean or "सिरदर्द" in c_clean:
                    c_norm = "headache"
                elif "abdominal" in c_clean or "पेट में दर्द" in c_clean:
                    c_norm = "abdominal pain"
                else:
                    c_norm = c_clean[:20] if len(c_clean) > 20 else c_clean
                
                complaint_breakdown[c_norm] = complaint_breakdown.get(c_norm, 0) + 1

        # 2. Mode & Language breakdown
        mode_counts = sessions.values("mode").annotate(count=Count("mode"))
        mode_breakdown = {item["mode"]: item["count"] for item in mode_counts}

        lang_counts = sessions.values("patient__language").annotate(count=Count("patient__language"))
        language_breakdown = {item["patient__language"]: item["count"] for item in lang_counts}

        # 3. Red flag rate
        red_flag_count = sessions.filter(red_flag=True).count()
        red_flag_rate = round(red_flag_count / total_sessions, 2) if total_sessions > 0 else 0.0

        # 4. Avg interview turns
        patient_turns_per_session = []
        for s in sessions:
            patient_turns_per_session.append(s.transcripts.filter(speaker="patient").count())
        avg_interview_turns = round(sum(patient_turns_per_session) / len(patient_turns_per_session), 1) if patient_turns_per_session else 0.0

        # 5. Avg OCR confidence
        docs = Document.objects.filter(session__created_at__date=today)
        avg_ocr_confidence = docs.aggregate(avg=Avg("confidence"))["avg"]
        avg_ocr_confidence = round(avg_ocr_confidence, 2) if avg_ocr_confidence is not None else 0.0

        # 6. Token outcomes
        token_outcomes = {
            "approved": sessions.filter(token_status="approved").count(),
            "rejected": sessions.filter(token_status="rejected").count(),
            "pending": sessions.filter(token_status="pending").count() + sessions.filter(token_status__isnull=True).count(),
        }

        # 7. Clarification needed rate
        clarification_count = sessions.filter(needed_clarification=True).count()
        clarification_needed_rate = round(clarification_count / total_sessions, 2) if total_sessions > 0 else 0.0

        # 8. Avg time to token (minutes)
        sessions_with_token = sessions.filter(token_generated_at__isnull=False)
        if sessions_with_token.exists():
            total_time = sum((s.token_generated_at - s.created_at).total_seconds() for s in sessions_with_token)
            avg_time_to_token_minutes = round((total_time / sessions_with_token.count()) / 60, 1)
        else:
            avg_time_to_token_minutes = 0.0

        return Response({
            "date_range": "today",
            "total_sessions": total_sessions,
            "complaint_breakdown": complaint_breakdown,
            "mode_breakdown": mode_breakdown,
            "language_breakdown": language_breakdown,
            "red_flag_rate": red_flag_rate,
            "avg_interview_turns": avg_interview_turns,
            "avg_ocr_confidence": avg_ocr_confidence,
            "token_outcomes": token_outcomes,
            "clarification_needed_rate": clarification_needed_rate,
            "avg_time_to_token_minutes": avg_time_to_token_minutes,
        })
