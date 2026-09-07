import time
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from core.models import Patient, Session, Transcript, LinkedRecord, Summary


class LockedFlowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.doctor_user = User.objects.create_user(username="testdoc", password="password123")
        self.token, _ = Token.objects.get_or_create(user=self.doctor_user)
        self.auth_headers = {"HTTP_AUTHORIZATION": f"Token {self.token.key}"}

    def test_identify_abha_yes_branch(self):
        """ABHA YES path: populates mock linked records for session."""
        response = self.client.post("/api/identify/", {
            "has_abha": True,
            "abha_id": "MOCK-MEERA-001",
            "language": "hi",
            "mode": "allopathic"
        }, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["has_abha"])
        self.assertGreater(data["linked_records_count"], 0)
        session = Session.objects.get(pk=data["session_id"])
        self.assertEqual(session.patient.name, "Meera Devi")
        self.assertEqual(session.linked_records.count(), 2)

    def test_identify_abha_no_branch(self):
        """ABHA NO path: basic registration collected, no linked records exist."""
        response = self.client.post("/api/identify/", {
            "has_abha": False,
            "basic_info": {"name": "Rajesh Kumar", "age": 45, "sex": "Male"},
            "language": "en",
            "mode": "allopathic"
        }, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertFalse(data["has_abha"])
        self.assertEqual(data["linked_records_count"], 0)
        session = Session.objects.get(pk=data["session_id"])
        self.assertEqual(session.patient.name, "Rajesh Kumar")
        self.assertEqual(session.patient.age, 45)
        self.assertEqual(session.patient.sex, "Male")

    def test_assisted_mode_branch(self):
        """Assisted Mode: session flagged when patient requests help."""
        p = Patient.objects.create(name="Test Patient", age=30, sex="Female")
        s = Session.objects.create(patient=p)
        response = self.client.post("/api/interview/assisted/", {
            "session_id": s.id,
            "assisted": True
        }, format="json")
        self.assertEqual(response.status_code, 200)
        s.refresh_from_db()
        self.assertTrue(s.assisted_mode)

    def test_decoupled_token_generation_normal(self):
        """Token returned immediately to patient without waiting for summary generation."""
        p = Patient.objects.create(name="Normal Patient", age=40, sex="Male")
        s = Session.objects.create(patient=p, red_flag=False)
        start_time = time.time()
        response = self.client.post("/api/token/generate/", {"session_id": s.id}, format="json")
        elapsed = time.time() - start_time
        
        self.assertEqual(response.status_code, 200)
        self.assertLess(elapsed, 1.0) # Confirm fast, non-blocking token response
        data = response.json()
        self.assertIsNotNone(data["token"])
        self.assertEqual(data["routing_instruction"], "direct_booth")
        self.assertIsNotNone(data["counter_number"])

    def test_decoupled_token_generation_red_flag(self):
        """Red Flag path: token returned immediately with 'reception' routing and null counter."""
        p = Patient.objects.create(name="Urgent Patient", age=60, sex="Male")
        s = Session.objects.create(patient=p, red_flag=True, red_flag_reason="Chest pain reported")
        response = self.client.post("/api/token/generate/", {"session_id": s.id}, format="json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["routing_instruction"], "reception")
        self.assertIsNone(data["counter_number"])
        self.assertIn("Reception", data["message"])

    def test_doctor_queue_and_patient_brief(self):
        """Doctor Queue lists patients with brief_status and Doctor Brief returns 6 categories."""
        p = Patient.objects.create(name="Brief Patient", age=52, sex="Female", abha_id="MOCK-MEERA-001")
        s = Session.objects.create(patient=p, token="T-9999", counter_number=2)
        Transcript.objects.create(session=s, turn=1, speaker="patient", text="I have chest discomfort.")
        
        # 1. Check queue before summary is generated -> brief_status == 'processing'
        q_res = self.client.get("/api/doctor/queue/", **self.auth_headers)
        self.assertEqual(q_res.status_code, 200)
        queue = q_res.json()["queue"]
        item = next(i for i in queue if i["session_id"] == s.id)
        self.assertEqual(item["brief_status"], "processing")

        # Create summary
        Summary.objects.create(
            session=s,
            structured_json={
                "chief_complaint": {"text": "Chest discomfort", "source_turns": [1]},
                "hpi": {"text": "Started 2 hours ago", "source_turns": [1]},
                "pmh": {"text": "T2DM"},
                "drug_allergy": {"text": "Penicillin"},
                "family_history": {"text": "Father: MI"},
                "personal_history": {"text": "Non-smoker"}
            }
        )
        s.status = Session.Status.SUMMARY_READY
        s.save()

        # 2. Check queue after summary ready -> brief_status == 'ready'
        q_res2 = self.client.get("/api/doctor/queue/", **self.auth_headers)
        queue2 = q_res2.json()["queue"]
        item2 = next(i for i in queue2 if i["session_id"] == s.id)
        self.assertEqual(item2["brief_status"], "ready")

        # 3. Check Doctor Brief endpoint returns all 6 categories
        b_res = self.client.get(f"/api/doctor/brief/{s.id}/", **self.auth_headers)
        self.assertEqual(b_res.status_code, 200)
        brief = b_res.json()
        cats = brief["categories"]
        self.assertIn("chief_complaint", cats)
        self.assertIn("symptoms", cats)
        self.assertIn("relevant_history", cats)
        self.assertIn("medications", cats)
        self.assertIn("important_flags", cats)
        self.assertIn("source_evidence", cats)
