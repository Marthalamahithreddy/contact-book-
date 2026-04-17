import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from database import get_db
from models import Contact, Phone
from schemas import ContactCreate, ContactOut, ContactUpdate, MergeRequest

router = APIRouter(prefix="/contacts", tags=["contacts"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _get_or_404(contact_id: str, db: Session) -> Contact:
    contact = db.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail=f"Contact '{contact_id}' not found")
    return contact


def _apply_phones(contact: Contact, phone_data, db: Session):
    """Replace all phones for a contact with the supplied list."""
    for ph in list(contact.phones):
        db.delete(ph)
    for p in phone_data:
        db.add(Phone(id=str(uuid.uuid4()), number=p.number, label=p.label, contact_id=contact.id))


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(payload: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact."""
    contact = Contact(
        id=str(uuid.uuid4()),
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
    )
    db.add(contact)
    db.flush()  # get the id before adding phones

    for p in payload.phones:
        db.add(Phone(id=str(uuid.uuid4()), number=p.number, label=p.label, contact_id=contact.id))

    db.commit()
    db.refresh(contact)
    return contact


@router.get("/", response_model=List[ContactOut])
def list_contacts(db: Session = Depends(get_db)):
    """Return all contacts."""
    return db.query(Contact).order_by(Contact.last_name, Contact.first_name).all()


@router.get("/search", response_model=List[ContactOut])
def search_contacts(
    q: str = Query(..., min_length=1, description="Search term"),
    db: Session = Depends(get_db),
):
    """
    Search contacts by:
    - first / last name (partial, case-insensitive)
    - email address (partial, case-insensitive)
    - phone number (partial match)
    """
    term = f"%{q.lower()}%"

    # Contacts whose name or email matches
    name_match = db.query(Contact).filter(
        or_(
            func.lower(Contact.first_name).like(term),
            func.lower(Contact.last_name).like(term),
            func.lower(Contact.first_name + " " + Contact.last_name).like(term),
            func.lower(func.coalesce(Contact.email, "")).like(term),
        )
    )

    # Contacts that have a matching phone number
    phone_match = (
        db.query(Contact)
        .join(Phone)
        .filter(Phone.number.like(term))
    )

    results = name_match.union(phone_match).all()
    return results


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, db: Session = Depends(get_db)):
    """Fetch a single contact by ID."""
    return _get_or_404(contact_id, db)


@router.put("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, payload: ContactUpdate, db: Session = Depends(get_db)):
    """Update a contact's fields.  Only supplied fields are changed."""
    contact = _get_or_404(contact_id, db)

    if payload.first_name is not None:
        contact.first_name = payload.first_name
    if payload.last_name is not None:
        contact.last_name = payload.last_name
    if payload.email is not None:
        contact.email = payload.email
    if payload.phones is not None:
        _apply_phones(contact, payload.phones, db)

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    """Permanently delete a contact."""
    contact = _get_or_404(contact_id, db)
    db.delete(contact)
    db.commit()


@router.post("/merge", response_model=ContactOut)
def merge_contacts(payload: MergeRequest, db: Session = Depends(get_db)):
    """
    Merge two contacts into one.

    - The **primary** contact is kept; the secondary is deleted.
    - Phone numbers from both contacts are combined (duplicates removed).
    - Name can be overridden via the request body; otherwise the
      primary contact's values are preserved.
    """
    if payload.primary_id == payload.secondary_id:
        raise HTTPException(status_code=400, detail="primary_id and secondary_id must differ")

    primary = _get_or_404(payload.primary_id, db)
    secondary = _get_or_404(payload.secondary_id, db)

    # Apply optional field overrides
    primary.first_name = payload.first_name or primary.first_name
    primary.last_name = payload.last_name or primary.last_name
    if payload.email is not None:
        primary.email = payload.email
    elif primary.email is None and secondary.email is not None:
        primary.email = secondary.email

    # Merge phone numbers — avoid duplicates
    existing_numbers = {ph.number for ph in primary.phones}
    for ph in secondary.phones:
        if ph.number not in existing_numbers:
            db.add(Phone(
                id=str(uuid.uuid4()),
                number=ph.number,
                label=ph.label,
                contact_id=primary.id,
            ))
            existing_numbers.add(ph.number)

    db.delete(secondary)
    db.commit()
    db.refresh(primary)
    return primary
