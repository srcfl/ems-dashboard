from influxdb_client import InfluxDBClient
from influxdb_client.client.flux_table import FluxTable
from typing import Optional
from datetime import datetime, timedelta

from .config import settings


class InfluxDBService:
    def __init__(self):
        self.client = InfluxDBClient(
            url=settings.influxdb_url,
            token=settings.influxdb_token,
            org=settings.influxdb_org,
        )
        self.query_api = self.client.query_api()
        self.bucket = settings.influxdb_bucket
        self.org = settings.influxdb_org

    def _query(self, flux_query: str) -> list[FluxTable]:
        return self.query_api.query(flux_query, org=self.org)

    def get_sites(self) -> list[str]:
        """Get all unique site IDs."""
        query = f'''
        import "influxdata/influxdb/schema"
        schema.tagValues(
            bucket: "{self.bucket}",
            tag: "site_id",
            predicate: (r) => r._measurement == "der"
        )
        '''
        tables = self._query(query)
        sites = []
        for table in tables:
            for record in table.records:
                sites.append(record.get_value())
        return sorted(sites)

    def get_sites_for_wallet(self, wallet_id: str) -> list[str]:
        """Get all site IDs owned by a specific wallet."""
        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "der" and r.wallet_id == "{wallet_id}")
        |> keep(columns: ["site_id"])
        |> distinct(column: "site_id")
        '''
        tables = self._query(query)
        sites = set()
        for table in tables:
            for record in table.records:
                site_id = record.values.get("site_id")
                if site_id:
                    sites.add(site_id)
        return sorted(list(sites))

    def get_wallet_for_site(self, site_id: str) -> Optional[str]:
        """Get the wallet ID that owns a specific site."""
        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "der" and r.site_id == "{site_id}")
        |> keep(columns: ["wallet_id"])
        |> distinct(column: "wallet_id")
        |> limit(n: 1)
        '''
        tables = self._query(query)
        for table in tables:
            for record in table.records:
                return record.values.get("wallet_id")
        return None

    def get_site_ders(self, site_id: str) -> list[dict]:
        """Get all DERs for a site with their latest data."""
        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "der" and r.site_id == "{site_id}")
        |> last()
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        tables = self._query(query)

        ders = {}
        for table in tables:
            for record in table.records:
                values = record.values
                der_type = values.get("type", "unknown")
                device_serial = values.get("device_serial", "unknown")
                key = f"{der_type}_{device_serial}"

                if key not in ders:
                    ders[key] = {
                        "type": der_type,
                        "device_serial": device_serial,
                        "device_type": values.get("device_type"),
                        "make": values.get("make"),
                        "timestamp": values.get("_time"),
                        "data": {}
                    }

                # Add all numeric fields
                for field, value in values.items():
                    if field.startswith("_") or field in ["type", "device_serial", "device_type", "make", "site_id", "gateway_id", "wallet_id", "host", "topic", "metric", "raw_version", "schema_version"]:
                        continue
                    if isinstance(value, (int, float)):
                        ders[key]["data"][field] = value

        return list(ders.values())

    def get_site_overview(self, site_id: str) -> dict:
        """Get site overview with aggregated power values."""
        ders = self.get_site_ders(site_id)

        overview = {
            "site_id": site_id,
            "timestamp": None,
            "total_pv_power_w": 0,
            "total_battery_power_w": 0,
            "total_grid_power_w": 0,
            "total_ev_power_w": 0,
            "load_w": 0,
            "battery_soc_avg": None,
            "ders": []
        }

        battery_socs = []

        for der in ders:
            der_type = der.get("type", "").lower()
            data = der.get("data", {})
            power = data.get("W", 0) or 0

            if overview["timestamp"] is None and der.get("timestamp"):
                overview["timestamp"] = der["timestamp"]

            if der_type == "pv":
                overview["total_pv_power_w"] += power
            elif der_type == "battery":
                overview["total_battery_power_w"] += power
                soc = data.get("SoC_nom_fract")
                if soc is not None:
                    battery_socs.append(soc)
            elif der_type in ["meter", "energymeter", "p1meter"]:
                overview["total_grid_power_w"] += power
            elif der_type in ["ev_charger", "v2x_charger", "charger"]:
                overview["total_ev_power_w"] += power

            overview["ders"].append({
                "type": der_type,
                "device_serial": der.get("device_serial"),
                "make": der.get("make"),
                "power_w": power,
                "data": data
            })

        # Calculate load (positive = consumption)
        # Load = Grid Import + PV Production - Battery Charge
        # Note: Grid import is positive, export is negative
        # Battery charge is positive, discharge is negative
        overview["load_w"] = (
            overview["total_grid_power_w"]
            + abs(overview["total_pv_power_w"])  # PV production is typically negative
            + overview["total_battery_power_w"]  # Battery discharge adds to load
        )

        if battery_socs:
            overview["battery_soc_avg"] = sum(battery_socs) / len(battery_socs)

        return overview

    def get_timeseries(
        self,
        site_id: str,
        der_type: Optional[str] = None,
        field: str = "W",
        start: str = "-1h",
        aggregate_window: str = "1m"
    ) -> list[dict]:
        """Get time series data for a site/DER."""
        type_filter = ""
        if der_type:
            type_filter = f'and r.type == "{der_type}"'

        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: {start})
        |> filter(fn: (r) => r._measurement == "der" and r.site_id == "{site_id}" {type_filter})
        |> filter(fn: (r) => r._field == "{field}")
        |> aggregateWindow(every: {aggregate_window}, fn: mean, createEmpty: false)
        |> yield(name: "mean")
        '''

        tables = self._query(query)

        series = []
        for table in tables:
            for record in table.records:
                series.append({
                    "timestamp": record.get_time().isoformat(),
                    "value": record.get_value(),
                    "type": record.values.get("type"),
                    "device_serial": record.values.get("device_serial")
                })

        return sorted(series, key=lambda x: x["timestamp"])

    def close(self):
        self.client.close()


# Singleton instance
influx_service = InfluxDBService()
