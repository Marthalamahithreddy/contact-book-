# Contact Book

A personal contact book application with a FastAPI backend and vanilla JS frontend.

---

## Features

- Add contacts with name, email, and multiple phone numbers
- Search by name, phone number, or email
- Edit and update contact details
- Delete contacts
- Merge two contacts into one

---

## Prerequisites

Make sure you have the following installed:

- Python 3.10 or higher — https://www.python.org/downloads/
- Git — https://git-scm.com/downloads

Check your Python version:

```bash
python3 --version
```

---

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/Marthalamahithreddy/contact-book-.git
cd contact-book
```

**2. Create a virtual environment**

```bash
python3 -m venv .venv
```

**3. Activate the virtual environment**

On macOS / Linux:
```bash
source .venv/bin/activate
```

On Windows:
```bash
.venv\Scripts\activate
```

**4. Install dependencies**

```bash
pip install -r requirements.txt
```

---

## Run

```bash
uvicorn main:app --reload
```

The server starts at `http://localhost:8000`

- Frontend: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/contacts/` | Create a contact |
| `GET` | `/contacts/` | List all contacts |
| `GET` | `/contacts/search?q=` | Search by name, phone, or email |
| `GET` | `/contacts/{id}` | Get a contact by ID |
| `PUT` | `/contacts/{id}` | Update a contact |
| `DELETE` | `/contacts/{id}` | Delete a contact |
| `POST` | `/contacts/merge` | Merge two contacts |

---

## Project Structure

```
contact-book/
├── main.py               # App entry point
├── database.py           # Database connection and session
├── models.py             # SQLAlchemy ORM models
├── schemas.py            # Pydantic request/response schemas
├── requirements.txt      # Python dependencies
├── routers/
│   └── contacts.py       # All contact API routes
└── frontend/
    ├── index.html        # App shell
    ├── style.css         # Styles
    └── app.js            # Frontend logic
```

---

## Stopping the Server

Press `Ctrl + C` in the terminal where the server is running.

## Deactivating the Virtual Environment

```bash
deactivate
```
