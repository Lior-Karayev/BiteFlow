"""
Demo script — shows the CourierRepository component in action.
Run: python main.py
"""

import uuid
from datetime import datetime, timedelta

from courier_repository import CourierRepository
from models import Courier, CourierStatus, DeliveryRecord, Shift, ShiftStatus


def main():
    repo = CourierRepository()  # uses SQLite by default

    # --- Register two couriers ---
    c1 = Courier(
        courier_id=str(uuid.uuid4()),
        name="Avi Cohen",
        phone="050-1111111",
        status=CourierStatus.AVAILABLE,
        current_latitude=32.0853,
        current_longitude=34.7818,
    )
    c2 = Courier(
        courier_id=str(uuid.uuid4()),
        name="Dana Levi",
        phone="050-2222222",
        status=CourierStatus.OFFLINE,
    )
    repo.save_courier(c1)
    repo.save_courier(c2)
    print("Registered couriers:")
    for c in repo.get_all_couriers():
        print(f"  {c.name} — {c.status.value}")

    # --- CourierAssigner: fetch available couriers ---
    available = repo.get_available_couriers()
    print(f"\nAvailable couriers: {[c.name for c in available]}")

    # --- LocationTracker: update GPS ---
    repo.update_courier_location(c1.courier_id, 32.09, 34.78)
    updated = repo.get_courier(c1.courier_id)
    print(f"\nUpdated location for {updated.name}: ({updated.current_latitude}, {updated.current_longitude})")

    # --- ShiftManager: submit a shift request ---
    shift = Shift(
        shift_id=str(uuid.uuid4()),
        courier_id=c1.courier_id,
        start_time=datetime.now() + timedelta(days=1),
        end_time=datetime.now() + timedelta(days=1, hours=8),
    )
    repo.save_shift(shift)
    print(f"\nPending shifts: {len(repo.get_pending_shifts())}")

    # --- ShiftApprover: approve the shift ---
    repo.update_shift_status(shift.shift_id, ShiftStatus.APPROVED)
    approved = repo.get_shifts(c1.courier_id)
    print(f"Shift status after approval: {approved[0].status.value}")

    # --- Delivery lifecycle ---
    delivery = DeliveryRecord(
        delivery_id=str(uuid.uuid4()),
        courier_id=c1.courier_id,
        order_id="ORDER-42",
        status="assigned",
    )
    repo.save_delivery(delivery)
    repo.update_delivery_status(delivery.delivery_id, "delivered")
    history = repo.get_delivery_history(c1.courier_id)
    print(f"\nDelivery history for {c1.name}: {[d.status for d in history]}")


if __name__ == "__main__":
    main()
