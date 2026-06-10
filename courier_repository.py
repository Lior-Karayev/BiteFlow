"""
CourierRepository — BiteFlow backend component.

Provided interface:  CourierData
    Public methods consumed by CourierAssigner and ShiftManager.

Required interface:  DBAccess
    Injected at construction; reads and writes the couriers, shifts,
    and deliveries tables in the central database.
"""

from datetime import datetime
from typing import List, Optional

from db_access import DBAccess, SQLiteDBAccess
from models import Courier, CourierStatus, DeliveryRecord, Shift, ShiftStatus


class CourierRepository:
    """
    Permanent repository for courier profiles, shift records, and delivery history.

    Provided interface: CourierData
    Required interface: DBAccess
    """

    def __init__(self, db: Optional[DBAccess] = None):
        self._db: DBAccess = db or SQLiteDBAccess()

    # ------------------------------------------------------------------
    # CourierData — provided interface (consumed by CourierAssigner)
    # ------------------------------------------------------------------

    def get_courier(self, courier_id: str) -> Optional[Courier]:
        """Return a single courier profile, or None if not found."""
        row = self._db.fetch_one(
            "SELECT * FROM couriers WHERE courier_id = ?", (courier_id,)
        )
        return self._row_to_courier(row) if row else None

    def get_all_couriers(self) -> List[Courier]:
        """Return every registered courier."""
        rows = self._db.fetch_all("SELECT * FROM couriers")
        return [self._row_to_courier(r) for r in rows]

    def get_available_couriers(self) -> List[Courier]:
        """Return couriers whose status is AVAILABLE (used by CourierAssigner)."""
        rows = self._db.fetch_all(
            "SELECT * FROM couriers WHERE status = ?", (CourierStatus.AVAILABLE.value,)
        )
        return [self._row_to_courier(r) for r in rows]

    def save_courier(self, courier: Courier) -> None:
        """Insert a new courier or update an existing one (upsert)."""
        self._db.execute(
            """
            INSERT INTO couriers (courier_id, name, phone, status, latitude, longitude, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(courier_id) DO UPDATE SET
                name      = excluded.name,
                phone     = excluded.phone,
                status    = excluded.status,
                latitude  = excluded.latitude,
                longitude = excluded.longitude
            """,
            (
                courier.courier_id,
                courier.name,
                courier.phone,
                courier.status.value,
                courier.current_latitude,
                courier.current_longitude,
                courier.created_at.isoformat(),
            ),
        )

    def update_courier_status(self, courier_id: str, status: CourierStatus) -> None:
        """Update a courier's availability status (AVAILABLE / BUSY / OFFLINE)."""
        self._db.execute(
            "UPDATE couriers SET status = ? WHERE courier_id = ?",
            (status.value, courier_id),
        )

    def update_courier_location(
        self, courier_id: str, latitude: float, longitude: float
    ) -> None:
        """Persist the latest GPS coordinates for a courier (called by LocationTracker)."""
        self._db.execute(
            "UPDATE couriers SET latitude = ?, longitude = ? WHERE courier_id = ?",
            (latitude, longitude, courier_id),
        )

    def delete_courier(self, courier_id: str) -> None:
        """Remove a courier record from the repository."""
        self._db.execute(
            "DELETE FROM couriers WHERE courier_id = ?", (courier_id,)
        )

    # ------------------------------------------------------------------
    # CourierData — provided interface (consumed by ShiftManager)
    # ------------------------------------------------------------------

    def get_shifts(self, courier_id: str) -> List[Shift]:
        """Return all shift records for a specific courier."""
        rows = self._db.fetch_all(
            "SELECT * FROM shifts WHERE courier_id = ? ORDER BY start_time",
            (courier_id,),
        )
        return [self._row_to_shift(r) for r in rows]

    def get_pending_shifts(self) -> List[Shift]:
        """Return all shift requests awaiting manager approval (used by ShiftApprover)."""
        rows = self._db.fetch_all(
            "SELECT * FROM shifts WHERE status = ? ORDER BY start_time",
            (ShiftStatus.PENDING.value,),
        )
        return [self._row_to_shift(r) for r in rows]

    def save_shift(self, shift: Shift) -> None:
        """Insert or update a shift record."""
        self._db.execute(
            """
            INSERT INTO shifts (shift_id, courier_id, start_time, end_time, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(shift_id) DO UPDATE SET
                start_time = excluded.start_time,
                end_time   = excluded.end_time,
                status     = excluded.status
            """,
            (
                shift.shift_id,
                shift.courier_id,
                shift.start_time.isoformat(),
                shift.end_time.isoformat(),
                shift.status.value,
                shift.created_at.isoformat(),
            ),
        )

    def update_shift_status(self, shift_id: str, status: ShiftStatus) -> None:
        """Approve or reject a pending shift request."""
        self._db.execute(
            "UPDATE shifts SET status = ? WHERE shift_id = ?",
            (status.value, shift_id),
        )

    # ------------------------------------------------------------------
    # CourierData — delivery history (consumed by DataCollector / KPI)
    # ------------------------------------------------------------------

    def get_delivery_history(self, courier_id: str) -> List[DeliveryRecord]:
        """Return the full delivery history for a courier."""
        rows = self._db.fetch_all(
            "SELECT * FROM deliveries WHERE courier_id = ? ORDER BY created_at DESC",
            (courier_id,),
        )
        return [self._row_to_delivery(r) for r in rows]

    def save_delivery(self, delivery: DeliveryRecord) -> None:
        """Insert or update a delivery record."""
        self._db.execute(
            """
            INSERT INTO deliveries
                (delivery_id, courier_id, order_id, pickup_time, delivery_time, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(delivery_id) DO UPDATE SET
                pickup_time   = excluded.pickup_time,
                delivery_time = excluded.delivery_time,
                status        = excluded.status
            """,
            (
                delivery.delivery_id,
                delivery.courier_id,
                delivery.order_id,
                delivery.pickup_time.isoformat() if delivery.pickup_time else None,
                delivery.delivery_time.isoformat() if delivery.delivery_time else None,
                delivery.status,
                delivery.created_at.isoformat(),
            ),
        )

    def update_delivery_status(self, delivery_id: str, status: str) -> None:
        """Update the status of a delivery (e.g. 'picked_up', 'delivered')."""
        self._db.execute(
            "UPDATE deliveries SET status = ? WHERE delivery_id = ?",
            (status, delivery_id),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _row_to_courier(row: dict) -> Courier:
        return Courier(
            courier_id=row["courier_id"],
            name=row["name"],
            phone=row["phone"],
            status=CourierStatus(row["status"]),
            current_latitude=row.get("latitude"),
            current_longitude=row.get("longitude"),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _row_to_shift(row: dict) -> Shift:
        return Shift(
            shift_id=row["shift_id"],
            courier_id=row["courier_id"],
            start_time=datetime.fromisoformat(row["start_time"]),
            end_time=datetime.fromisoformat(row["end_time"]),
            status=ShiftStatus(row["status"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _row_to_delivery(row: dict) -> DeliveryRecord:
        return DeliveryRecord(
            delivery_id=row["delivery_id"],
            courier_id=row["courier_id"],
            order_id=row["order_id"],
            pickup_time=datetime.fromisoformat(row["pickup_time"]) if row.get("pickup_time") else None,
            delivery_time=datetime.fromisoformat(row["delivery_time"]) if row.get("delivery_time") else None,
            status=row["status"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )
