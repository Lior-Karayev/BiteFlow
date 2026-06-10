# CourierRepository — BiteFlow Backend Component

## Overview

`CourierRepository` is a backend component of the **BiteFlow** food-delivery platform.  
It is the permanent data store for all courier-related data: profiles, shift requests, and delivery history.

### Component interfaces (as defined in the SAD)

| Interface | Direction | Description |
|---|---|---|
| `CourierData` | **Provided** | Public API consumed by `CourierAssigner` and `ShiftManager` |
| `DBAccess` | **Required** | Injected database adapter; reads and writes the courier tables |

---

## File structure

```
CourierRepository/
├── models.py              # Courier, Shift, DeliveryRecord data classes
├── db_access.py           # DBAccess interface + SQLiteDBAccess implementation
├── courier_repository.py  # Main component — CourierData provided interface
├── main.py                # Demo / usage example
└── README.md
```

---

## Requirements

- Python 3.8 or higher  
- No third-party packages needed (uses the Python standard library only)

---

## How to run

```bash
cd CourierRepository
python main.py
```

This runs a demo that:
1. Registers two couriers in a local SQLite database (`biteflow.db`)
2. Queries available couriers (simulating `CourierAssigner`)
3. Updates GPS coordinates (simulating `LocationTracker`)
4. Submits and approves a shift request (simulating `ShiftManager` / `ShiftApprover`)
5. Records and updates a delivery (simulating the delivery lifecycle)

---

## Public methods — CourierData interface

### Courier profile management
| Method | Description |
|---|---|
| `get_courier(courier_id)` | Fetch a single courier by ID |
| `get_all_couriers()` | Return all registered couriers |
| `get_available_couriers()` | Return couriers with status `AVAILABLE` (used by `CourierAssigner`) |
| `save_courier(courier)` | Insert or update a courier profile |
| `update_courier_status(courier_id, status)` | Set status to `AVAILABLE`, `BUSY`, or `OFFLINE` |
| `update_courier_location(courier_id, lat, lon)` | Persist latest GPS coordinates |
| `delete_courier(courier_id)` | Remove a courier from the repository |

### Shift management (consumed by ShiftManager / ShiftApprover)
| Method | Description |
|---|---|
| `get_shifts(courier_id)` | Return all shifts for a courier |
| `get_pending_shifts()` | Return all unapproved shift requests |
| `save_shift(shift)` | Insert or update a shift record |
| `update_shift_status(shift_id, status)` | Approve or reject a shift (`APPROVED` / `REJECTED`) |

### Delivery history (consumed by DataCollector / KPI)
| Method | Description |
|---|---|
| `get_delivery_history(courier_id)` | Full delivery history for a courier |
| `save_delivery(delivery)` | Insert or update a delivery record |
| `update_delivery_status(delivery_id, status)` | Update status (e.g. `"picked_up"`, `"delivered"`) |

---

## Using a custom database backend

`CourierRepository` depends on the `DBAccess` abstract interface.  
Inject any implementation at construction time:

```python
from db_access import DBAccess
from courier_repository import CourierRepository

class MyPostgresDB(DBAccess):
    # implement execute / fetch_one / fetch_all
    ...

repo = CourierRepository(db=MyPostgresDB(...))
```

The default is `SQLiteDBAccess`, which writes to `biteflow.db` in the working directory.
