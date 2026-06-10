"""
DBAccess — required interface.
Abstracts all reads/writes to the courier tables in the central database.
The SQLiteDBAccess class is the default implementation using a local SQLite file.
"""

import sqlite3
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class DBAccess(ABC):
    @abstractmethod
    def execute(self, query: str, params: tuple = ()) -> None:
        pass

    @abstractmethod
    def fetch_one(self, query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def fetch_all(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        pass


class SQLiteDBAccess(DBAccess):
    def __init__(self, db_path: str = "biteflow.db"):
        self._db_path = db_path
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS couriers (
                    courier_id   TEXT PRIMARY KEY,
                    name         TEXT NOT NULL,
                    phone        TEXT NOT NULL UNIQUE,
                    status       TEXT NOT NULL DEFAULT 'offline',
                    latitude     REAL,
                    longitude    REAL,
                    created_at   TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS shifts (
                    shift_id     TEXT PRIMARY KEY,
                    courier_id   TEXT NOT NULL REFERENCES couriers(courier_id),
                    start_time   TEXT NOT NULL,
                    end_time     TEXT NOT NULL,
                    status       TEXT NOT NULL DEFAULT 'pending',
                    created_at   TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS deliveries (
                    delivery_id   TEXT PRIMARY KEY,
                    courier_id    TEXT NOT NULL REFERENCES couriers(courier_id),
                    order_id      TEXT NOT NULL,
                    pickup_time   TEXT,
                    delivery_time TEXT,
                    status        TEXT NOT NULL DEFAULT 'assigned',
                    created_at    TEXT NOT NULL
                );
            """)

    def execute(self, query: str, params: tuple = ()) -> None:
        with self._connect() as conn:
            conn.execute(query, params)

    def fetch_one(self, query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(query, params).fetchone()
            return dict(row) if row else None

    def fetch_all(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]
