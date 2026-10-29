import os
import subprocess
import sys

import pytest


@pytest.mark.parametrize("level", ["DEBUG", "INFO", "WARNING"])
def test_logging_level_and_single_stdout_handler(level: str) -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import logging; "
            "from uvicorn.config import LOGGING_CONFIG; "
            "logging.config.dictConfig(LOGGING_CONFIG); "
            "from app.core.logging import setup_logging; "
            "setup_logging(); setup_logging(); "
            "names = ('app.money_manager.router', 'uvicorn', 'uvicorn.error', 'uvicorn.access'); "
            "[(logging.getLogger(name).debug('debug marker'), "
            "logging.getLogger(name).info('info marker'), "
            "logging.getLogger(name).warning('warning marker')) for name in names]",
        ],
        env={**os.environ, "LOG_LEVEL": f" {level.lower()} "},
        capture_output=True,
        text=True,
        check=True,
    )

    assert result.stderr == ""
    assert result.stdout.count("warning marker") == 4
    assert result.stdout.count("info marker") == (0 if level == "WARNING" else 4)
    assert result.stdout.count("debug marker") == (4 if level == "DEBUG" else 0)
    assert "app.money_manager.router:" in result.stdout
    assert "uvicorn.access:" in result.stdout
