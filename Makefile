PY ?= python
NPM ?= npm
export NPM_CONFIG_UPDATE_NOTIFIER := false

# Some Windows make builds (MSYS) drop APPDATA, which hides pip --user packages from Python.
ifeq ($(APPDATA),)
export APPDATA := $(shell cygpath -w -F 26 2>/dev/null)
endif

.PHONY: setup test test-backend test-js dev demo-cli export-scenario audio

setup:
	$(PY) -m pip install -r requirements-dev.txt
	cd frontend && $(NPM) install

test: test-backend test-js

test-backend:
	$(PY) -m pytest -q

test-js:
	cd frontend && npx vitest run

dev:
	$(PY) -m uvicorn backend.api.main:app --reload --port 8000

demo-cli:
	node scripts/export_templates.mjs
	$(PY) scripts/demo_cli.py

export-scenario:
	$(PY) scripts/export_scenario.py

# Needs network: regenerates frontend/public/audio (edge-tts neural voices).
audio:
	node scripts/export_templates.mjs
	$(PY) scripts/generate_audio.py
