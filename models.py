from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class CourierStatus(Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"


class ShiftStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class Courier:
    courier_id: str
    name: str
    phone: str
    status: CourierStatus = CourierStatus.OFFLINE
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Shift:
    shift_id: str
    courier_id: str
    start_time: datetime
    end_time: datetime
    status: ShiftStatus = ShiftStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class DeliveryRecord:
    delivery_id: str
    courier_id: str
    order_id: str
    pickup_time: Optional[datetime] = None
    delivery_time: Optional[datetime] = None
    status: str = "assigned"
    created_at: datetime = field(default_factory=datetime.now)
