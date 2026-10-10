"""Settings, read from backend/.env so the models use the same database as the app.

Environment variables win over the file, so `DB_NAME=b2b_ml python -m b2b_ml ...`
points a run at another database.
"""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env", override=False)

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"


@dataclass(frozen=True)
class DatabaseSettings:
    host: str
    port: int
    user: str
    password: str
    name: str


def database_settings() -> DatabaseSettings:
    return DatabaseSettings(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
        name=os.environ.get("DB_NAME", "b2b_management"),
    )
