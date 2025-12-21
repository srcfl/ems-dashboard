from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DERBase(BaseModel):
    type: str
    device_serial: Optional[str] = None
    device_type: Optional[str] = None
    make: Optional[str] = None


class BatteryData(DERBase):
    power_w: Optional[float] = None
    soc_fraction: Optional[float] = None
    capacity_wh: Optional[float] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    dc_power_w: Optional[float] = None
    temperature_c: Optional[float] = None


class PVData(DERBase):
    power_w: Optional[float] = None
    rated_power_w: Optional[float] = None
    mppt1_voltage: Optional[float] = None
    mppt1_current: Optional[float] = None
    mppt2_voltage: Optional[float] = None
    mppt2_current: Optional[float] = None
    dc_power_w: Optional[float] = None
    temperature_c: Optional[float] = None


class MeterData(DERBase):
    power_w: Optional[float] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    frequency_hz: Optional[float] = None
    l1_power_w: Optional[float] = None
    l2_power_w: Optional[float] = None
    l3_power_w: Optional[float] = None
    l1_voltage: Optional[float] = None
    l2_voltage: Optional[float] = None
    l3_voltage: Optional[float] = None


class EVChargerData(DERBase):
    power_w: Optional[float] = None
    dc_power_w: Optional[float] = None
    ev_soc_fraction: Optional[float] = None
    ev_min_energy_req_wh: Optional[float] = None
    ev_max_energy_req_wh: Optional[float] = None
    offered_current: Optional[float] = None


class SiteOverview(BaseModel):
    site_id: str
    timestamp: Optional[datetime] = None
    total_pv_power_w: float = 0
    total_battery_power_w: float = 0
    total_grid_power_w: float = 0
    total_ev_power_w: float = 0
    load_w: float = 0
    battery_soc_avg: Optional[float] = None
    ders: list[DERBase] = []


class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    value: float


class TimeSeriesData(BaseModel):
    field: str
    der_type: str
    device_serial: Optional[str] = None
    data: list[TimeSeriesPoint]
