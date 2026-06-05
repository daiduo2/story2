BACKEND_PORT := 3724
FRONTEND_PORT := 7546
BACKEND_PID := .backend.pid
FRONTEND_PID := .frontend.pid
PUBLIC_DIR := public

.PHONY: all dev stop build clean kill-ports status

all: build

build:
	@pnpm run build

# Detect and kill any process using the target ports
kill-ports:
	@echo "Checking ports $(BACKEND_PORT) and $(FRONTEND_PORT)..."
	@lsof -ti:$(BACKEND_PORT) 2>/dev/null | xargs kill 2>/dev/null || true
	@lsof -ti:$(FRONTEND_PORT) 2>/dev/null | xargs kill 2>/dev/null || true
	@sleep 0.3

# Start both backend and frontend
# If ports are occupied, kill existing processes first
dev: kill-ports build
	@echo "Starting backend on port $(BACKEND_PORT)..."
	@node dist/agent/server.js > .backend.log 2>&1 & echo $$! > $(BACKEND_PID)
	@echo "Starting frontend on port $(FRONTEND_PORT)..."
	@cd $(PUBLIC_DIR) && python3 -m http.server $(FRONTEND_PORT) > ../.frontend.log 2>&1 & echo $$! > ../$(FRONTEND_PID)
	@sleep 2
	@echo ""
	@echo "Services started:"
	@echo "  Backend:  http://localhost:$(BACKEND_PORT)"
	@echo "  Frontend: http://localhost:$(FRONTEND_PORT)"
	@echo ""
	@echo "Run 'make stop' to stop all services"

# Stop services and force-release ports
stop:
	@echo "Stopping services..."
	@if [ -f $(BACKEND_PID) ]; then kill $$(cat $(BACKEND_PID)) 2>/dev/null || true; rm -f $(BACKEND_PID); fi
	@if [ -f $(FRONTEND_PID) ]; then kill $$(cat $(FRONTEND_PID)) 2>/dev/null || true; rm -f $(FRONTEND_PID); fi
	@lsof -ti:$(BACKEND_PORT) 2>/dev/null | xargs kill 2>/dev/null || true
	@lsof -ti:$(FRONTEND_PORT) 2>/dev/null | xargs kill 2>/dev/null || true
	@rm -f .backend.log .frontend.log
	@echo "All services stopped."

# Show running status
status:
	@echo "Backend port $(BACKEND_PORT):"
	@lsof -ti:$(BACKEND_PORT) 2>/dev/null | xargs ps -p 2>/dev/null || echo "  Not running"
	@echo "Frontend port $(FRONTEND_PORT):"
	@lsof -ti:$(FRONTEND_PORT) 2>/dev/null | xargs ps -p 2>/dev/null || echo "  Not running"

# Clean build artifacts and logs
clean:
	@rm -rf dist public/js .backend.pid .frontend.pid .backend.log .frontend.log
	@echo "Cleaned build artifacts and logs."
