from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import Base, engine
from routers import contacts

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Contact Book API",
    description="Personal contact book — create, search, update, delete, and merge contacts.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contacts.router)
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse("frontend/index.html")
