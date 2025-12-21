from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = ""
    influxdb_org: str = ""
    influxdb_bucket: str = "srcful-prod"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
