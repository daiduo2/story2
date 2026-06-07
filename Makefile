PORT := 3724
PID_FILE := .server.pid

.PHONY: all dev stop build clean kill-port status

all: build

build:
	@pnpm run build

# Detect and kill any process using the target port
kill-port:
	@echo "Checking port $(PORT)..."
	@lsof -ti:$(PORT) 2>/dev/null | xargs kill 2>/dev/null || true
	@sleep 0.3

LOG_DIR := log

# Start the unified server (backend API + static files + dynamic markdown pages)
dev: kill-port build
	@mkdir -p $(LOG_DIR)
	@echo "Starting server on port $(PORT)..."
	@node dist/agent/server.js & echo $$! > $(PID_FILE)
	@sleep 2
	@echo ""
	@echo "Server started: http://localhost:$(PORT)"
	@echo "Log directory:  $(LOG_DIR)/"
	@echo ""
	@echo "Run 'make stop' to stop"
	@echo "Run 'make logs'  to list recent logs"

# Stop server and force-release port
stop:
	@echo "Stopping server..."
	@if [ -f $(PID_FILE) ]; then kill $$(cat $(PID_FILE)) 2>/dev/null || true; rm -f $(PID_FILE); fi
	@lsof -ti:$(PORT) 2>/dev/null | xargs kill 2>/dev/null || true
	@echo "Server stopped."

# List recent log files
logs:
	@if [ -d $(LOG_DIR) ]; then ls -lt $(LOG_DIR) | head -10; else echo "No logs yet"; fi

# Show running status
status:
	@echo "Server port $(PORT):"
	@lsof -ti:$(PORT) 2>/dev/null | xargs ps -p 2>/dev/null || echo "  Not running"

# Clean build artifacts and logs
clean:
	@rm -rf dist public/js $(PID_FILE) $(LOG_DIR)
	@echo "Cleaned build artifacts and logs."
