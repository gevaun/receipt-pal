import logging.config
import os


def setup_logging() -> None:
    """Log to stdout; level comes from LOG_LEVEL (default INFO)."""
    level = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
                }
            },
            "handlers": {
                "stdout": {
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                    "formatter": "default",
                }
            },
            "root": {"level": level, "handlers": ["stdout"]},
            # Route uvicorn's loggers through the root handler so the format is consistent.
            "loggers": {
                "uvicorn": {"level": level, "handlers": [], "propagate": True},
                "uvicorn.error": {"level": level, "handlers": [], "propagate": True},
                "uvicorn.access": {"level": level, "handlers": [], "propagate": True},
            },
        }
    )
