from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolated_settings_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "settings.json"
    monkeypatch.setenv("RECEIPT_PAL_SETTINGS_FILE", str(path))
    return path
