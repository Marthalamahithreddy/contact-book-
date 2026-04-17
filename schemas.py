from __future__ import annotations
from pydantic import BaseModel, field_validator
from typing import List, Optional


class PhoneIn(BaseModel):
    number: str
    label: str = "mobile"

    @field_validator("number")
    @classmethod
    def number_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Phone number must not be empty")
        return v


class PhoneOut(PhoneIn):
    id: str

    model_config = {"from_attributes": True}


class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None


class ContactCreate(ContactBase):
    phones: List[PhoneIn] = []


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phones: Optional[List[PhoneIn]] = None


class ContactOut(ContactBase):
    id: str
    phones: List[PhoneOut] = []

    model_config = {"from_attributes": True}


class MergeRequest(BaseModel):
    primary_id: str
    secondary_id: str
    # Optional overrides; if omitted the primary contact's values are kept
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
