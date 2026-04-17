import uuid
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=generate_uuid)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=True)

    phones = relationship("Phone", back_populates="contact", cascade="all, delete-orphan")


class Phone(Base):
    __tablename__ = "phones"

    id = Column(String, primary_key=True, default=generate_uuid)
    number = Column(String, nullable=False)
    label = Column(String, default="mobile")  # e.g. mobile, home, work
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=False)

    contact = relationship("Contact", back_populates="phones")
