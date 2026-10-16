import re
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.ai.llm_service import generate_answer
from app.models.campus_location import CampusLocation
from app.models.emergency_contact import EmergencyContact
from app.models.faq import FAQ


def answer_campus_question(
    db: Session,
    question: str,
    provider: str | None = None,
    model: str | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Hybrid approach:
    1. Match active campus locations.
    2. Return active emergency contacts for safety-related questions.
    3. Fall back to the configured LLM for general campus questions.
    """

    question_lower = question.strip().lower()
    if not question_lower:
        return "Please enter a campus question.", []

    # ----- 1. Location name matching -----
    location_terms = re.findall(r"[a-z0-9]+", question_lower)
    location_filters = [
        field.ilike(f"%{term}%")
        for term in location_terms
        for field in (
            CampusLocation.name,
            CampusLocation.category,
            CampusLocation.description,
        )
    ]
    locations = (
        db.query(CampusLocation)
        .filter(CampusLocation.is_active.is_(True), or_(*location_filters))
        .limit(3)
        .all()
        if location_filters
        else []
    )

    if locations:
        loc = locations[0]
        answer = (
            f"{loc.name} is a {loc.category} on campus.\n"
            f"{loc.description or ''}\n"
            f"Coordinates: {loc.latitude}, {loc.longitude}\n"
            f"You can get walking directions using the map feature."
        )
        return answer, [{"type": "location", "id": loc.id, "name": loc.name}]

    # ----- 2. Emergency contacts -----
    if any(word in question_lower for word in ["emergency", "security", "clinic", "help", "sos"]):
        contacts = (
            db.query(EmergencyContact)
            .filter(EmergencyContact.is_active.is_(True))
            .order_by(EmergencyContact.name)
            .limit(5)
            .all()
        )
        if contacts:
            lines = [
                f"- {contact.name} ({contact.category or 'Support'}): "
                f"{contact.phone or 'N/A'}"
                for contact in contacts
            ]
            answer = "Here are the important emergency contacts:\n\n" + "\n".join(lines)
            return answer, [
                {
                    "type": "emergency_contact",
                    "id": contact.id,
                    "name": contact.name,
                }
                for contact in contacts
            ]

    # ----- 3. Use published FAQs as context for an AI-generated answer -----
    stop_words = {"about", "can", "does", "how", "is", "tell", "the", "what", "when", "where", "who"}
    faq_terms = [
        term for term in location_terms
        if len(term) > 3 and term not in stop_words
    ]
    faq_filters = [
        field.ilike(f"%{term}%")
        for term in faq_terms
        for field in (FAQ.question, FAQ.answer, FAQ.category)
    ]
    matching_faqs = (
        db.query(FAQ)
        .filter(FAQ.is_active.is_(True), or_(*faq_filters))
        .limit(4)
        .all()
        if faq_filters
        else []
    )
    faq_context = "\n\n".join(
        f"FAQ: {faq.question}\nAnswer: {faq.answer}"
        for faq in matching_faqs
    )

    # ----- 4. Fall back to general campus guidance when no FAQ matches -----
    campus_context = """
    You are the campus assistant for Bayero University Kano (BUK).
    You help students with locations, administrative procedures, events and emergency information.
    If you do not know something specific, advise the student to check the Student Affairs Division or their departmental office.
    """

    prompt = f"""{campus_context}
Use the published FAQs below as your trusted source when they are relevant.
If no FAQ answers the question, answer briefly with general knowledge and do not invent BUK-specific facts.
Keep your answer concise.

Published FAQs:
{faq_context or "No matching published FAQ was found."}

Student question: {question}

Answer helpfully and concisely:"""

    answer = generate_answer(
        prompt,
        max_tokens=180,
        provider=provider,
        model=model,
        timeout=120.0,
    )
    sources = [
        {"type": "faq", "id": faq.id, "question": faq.question}
        for faq in matching_faqs
    ]
    return answer, sources or [{"type": "llm_fallback"}]
