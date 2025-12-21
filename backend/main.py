from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .influx import influx_service
from .config import settings

app = FastAPI(
    title="EMS Dashboard API",
    description="API for Sourceful Energy Management System Dashboard",
    version="0.1.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "EMS Dashboard API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/sites")
async def list_sites():
    """List all available sites."""
    try:
        sites = influx_service.get_sites()
        return {"sites": sites, "count": len(sites)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/wallet/{wallet_address}/sites")
async def get_sites_for_wallet(wallet_address: str):
    """Get all sites owned by a specific wallet address."""
    try:
        sites = influx_service.get_sites_for_wallet(wallet_address)
        return {"wallet": wallet_address, "sites": sites, "count": len(sites)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sites/{site_id}/wallet")
async def get_site_wallet(site_id: str):
    """Get the wallet that owns a specific site."""
    try:
        wallet = influx_service.get_wallet_for_site(site_id)
        if not wallet:
            raise HTTPException(status_code=404, detail=f"Site {site_id} not found")
        return {"site_id": site_id, "wallet": wallet}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sites/{site_id}")
async def get_site(site_id: str):
    """Get site overview with all DERs and aggregated data."""
    try:
        overview = influx_service.get_site_overview(site_id)
        if not overview["ders"]:
            raise HTTPException(status_code=404, detail=f"Site {site_id} not found or has no data")
        return overview
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sites/{site_id}/ders")
async def get_site_ders(site_id: str):
    """Get all DERs for a site with their latest data."""
    try:
        ders = influx_service.get_site_ders(site_id)
        if not ders:
            raise HTTPException(status_code=404, detail=f"Site {site_id} not found or has no DERs")
        return {"site_id": site_id, "ders": ders, "count": len(ders)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sites/{site_id}/timeseries")
async def get_timeseries(
    site_id: str,
    der_type: Optional[str] = Query(None, description="Filter by DER type (pv, battery, meter, etc.)"),
    field: str = Query("W", description="Field to query (W, SoC_nom_fract, V, A, etc.)"),
    start: str = Query("-1h", description="Start time (e.g., -1h, -24h, -7d)"),
    aggregate: str = Query("1m", description="Aggregation window (e.g., 1m, 5m, 1h)")
):
    """Get time series data for a site."""
    try:
        data = influx_service.get_timeseries(
            site_id=site_id,
            der_type=der_type,
            field=field,
            start=start,
            aggregate_window=aggregate
        )
        return {
            "site_id": site_id,
            "der_type": der_type,
            "field": field,
            "start": start,
            "aggregate": aggregate,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
async def shutdown():
    influx_service.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
