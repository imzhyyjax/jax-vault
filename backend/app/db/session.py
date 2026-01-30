import os
import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://jax:imzhyyjax@localhost/jaxvault"
)

def get_conn():
    return psycopg2.connect(
        DB_URL,
        cursor_factory=RealDictCursor
    )