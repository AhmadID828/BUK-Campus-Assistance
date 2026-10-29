import re
from datetime import date
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.campus_location import CampusLocation
from app.models.emergency_contact import EmergencyContact
from app.models.event import Event
from app.models.faq import FAQ


_STOP_WORDS = {
    "about", "are", "can", "could", "do", "does", "for", "from", "how",
    "i", "in", "is", "it", "me", "of", "on", "please", "tell", "the",
    "there", "this", "to", "what", "when", "where", "which", "who", "would",
}
_EVENT_WORDS = {"event", "events", "happening", "upcoming"}
_EMERGENCY_WORDS = {
    "ambulance", "clinic", "emergency", "hospital", "police", "safety",
    "security", "sos",
}
_LOCATION_WORDS = {
    "address", "building", "direction", "directions", "find", "locate",
    "location", "map", "near", "where",
}
_CAMPUS_TERMS = {
    "admission", "bursary", "campus", "clearance", "department", "faculty",
    "hostel", "office", "registration", "register", "student", "transcript",
    "tuition", "university",
}
_NOT_FOUND = (
    "I couldn't find that information in the current campus records. "
    "Please check with the relevant university office or ask an administrator "
    "to update the campus information."
)


def _terms(question: str, excluded: set[str] | None = None) -> list[str]:
    excluded_words = _STOP_WORDS | (excluded or set())
    return [
        term
        for term in dict.fromkeys(re.findall(r"[a-z0-9]+", question.lower()))
        if len(term) > 2 and term not in excluded_words
    ]


def is_campus_intent(question: str) -> bool:
    words = set(re.findall(r"[a-z0-9]+", question.lower()))
    return bool(
        words.intersection(
            _CAMPUS_TERMS | _EVENT_WORDS | _EMERGENCY_WORDS | _LOCATION_WORDS
            | {"contact", "contacts", "phone", "number", "faq", "faqs"}
        )
    )


def _matching_rows(
    db: Session,
    model: Any,
    fields: tuple[Any, ...],
    terms: list[str],
    *,
    active_field: Any,
    future_events: bool = False,
) -> list[Any]:
    query = db.query(model).filter(active_field.is_(True))
    if future_events:
        query = query.filter(Event.event_date >= date.today())
    if terms:
        filters = [field.ilike(f"%{term}%") for field in fields for term in terms]
        query = query.filter(or_(*filters))
    return query.all()


def _score(row: Any, fields: tuple[str, ...], terms: list[str]) -> int:
    searchable_text = " ".join(
        str(getattr(row, field, "") or "").lower() for field in fields
    )
    return sum(term in searchable_text for term in terms)


def _ranked(rows: list[Any], fields: tuple[str, ...], terms: list[str]) -> list[Any]:
    return sorted(
        (row for row in rows if _score(row, fields, terms) > 0),
        key=lambda row: (-_score(row, fields, terms), getattr(row, "id", 0)),
    )


def _source(source_type: str, row: Any, **extra: Any) -> dict[str, Any]:
    return {"type": source_type, "id": row.id, **extra}


def _format_location(location: CampusLocation) -> str:
    details = [f"{location.name} is a {location.category} on campus."]
    if location.description:
        details.append(location.description)
    details.append(
        f"Coordinates: {location.latitude}, {location.longitude}. "
        "You can get walking directions using the map feature."
    )
    return "\n".join(details)


def _format_event(event: Event) -> str:
    details = [event.title, f"Date: {event.event_date}"]
    if event.start_time:
        time = event.start_time
        if event.end_time:
            time += f"–{event.end_time}"
        details.append(f"Time: {time}")
    if event.location:
        details.append(f"Location: {event.location}")
    if event.description:
        details.append(event.description)
    return " | ".join(details)


def answer_campus_question(
    db: Session,
    question: str,
    provider: str | None = None,
    model: str | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """Answer campus questions only with active, admin-managed database records."""
    del provider, model

    question = question.strip()
    if not question:
        return "Please enter a campus question.", []

    question_lower = question.lower()
    event_intent = bool(_EVENT_WORDS.intersection(re.findall(r"[a-z0-9]+", question_lower)))
    question_words = set(re.findall(r"[a-z0-9]+", question_lower))
    location_intent = bool(question_words.intersection(_LOCATION_WORDS))
    emergency_intent = bool(
        question_words.intersection(
            _EMERGENCY_WORDS - {"clinic", "hospital"}
        )
        or question_words.intersection({"contact", "contacts", "phone", "number"})
        or (
            question_words.intersection({"clinic", "hospital"})
            and not location_intent
        )
    )

    if emergency_intent:
        terms = _terms(question, _EMERGENCY_WORDS | {"contact", "contacts", "phone"})
        contacts = _matching_rows(
            db,
            EmergencyContact,
            (EmergencyContact.name, EmergencyContact.category, EmergencyContact.location, EmergencyContact.description),
            terms,
            active_field=EmergencyContact.is_active,
        )
        ranked_contacts = _ranked(
            contacts,
            ("name", "category", "location", "description"),
            terms,
        )
        if terms and ranked_contacts:
            contacts = ranked_contacts
        contacts = sorted(contacts, key=lambda contact: (contact.name.lower(), contact.id))[:5]
        if contacts:
            lines = [
                f"- {contact.name} ({contact.category or 'Support'}): "
                f"{contact.phone}"
                + (f" / {contact.alternative_phone}" if contact.alternative_phone else "")
                + (f"; location: {contact.location}" if contact.location else "")
                for contact in contacts
            ]
            return "Emergency contacts from campus records:\n\n" + "\n".join(lines), [
                _source("emergency_contact", contact, name=contact.name)
                for contact in contacts
            ]

    if event_intent:
        terms = _terms(question, _EVENT_WORDS)
        events = _matching_rows(
            db,
            Event,
            (Event.title, Event.description, Event.category, Event.location, Event.organizer),
            terms,
            active_field=Event.is_active,
            future_events=True,
        )
        if terms:
            events = _ranked(
                events,
                ("title", "description", "category", "location", "organizer"),
                terms,
            )
        else:
            events = sorted(events, key=lambda event: (event.event_date, event.id))
        events = events[:5]
        if events:
            return "Upcoming events from campus records:\n\n" + "\n".join(
                f"- {_format_event(event)}" for event in events
            ), [
                _source("event", event, title=event.title)
                for event in events
            ]
        return "There are no matching upcoming events in the current campus records.", []

    terms = _terms(
        question,
        _LOCATION_WORDS
        | _EVENT_WORDS
        | (_EMERGENCY_WORDS - {"clinic", "hospital"}),
    )
    if not terms:
        return _NOT_FOUND, []

    locations = _matching_rows(
        db,
        CampusLocation,
        (CampusLocation.name, CampusLocation.category, CampusLocation.description),
        terms,
        active_field=CampusLocation.is_active,
    )
    ranked_locations = _ranked(locations, ("name", "category", "description"), terms)

    faqs = _matching_rows(
        db,
        FAQ,
        (FAQ.question, FAQ.answer, FAQ.category),
        terms,
        active_field=FAQ.is_active,
    )
    ranked_faqs = _ranked(faqs, ("question", "answer", "category"), terms)

    if location_intent and ranked_locations:
        location = ranked_locations[0]
        return _format_location(location), [
            _source("location", location, name=location.name)
        ]

    if ranked_faqs:
        faq = ranked_faqs[0]
        return faq.answer, [_source("faq", faq, question=faq.question)]

    if ranked_locations:
        location = ranked_locations[0]
        return _format_location(location), [
            _source("location", location, name=location.name)
        ]

    return _NOT_FOUND, []
