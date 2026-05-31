.PHONY: help secrets secrets-init gen-opaque gen-session-secret gen-admin-key gen-notify-key

ENV_FILE ?= .env

help:
	@echo "Secret generation:"
	@echo "  make secrets            Print OPAQUE_SERVER_SETUP, SESSION_SECRET, ADMIN_KEY, NOTIFY_ENCRYPTION_KEY as dotenv lines"
	@echo "  make secrets-init       Write the secrets to \$$ENV_FILE (default: .env). Refuses to overwrite."
	@echo "  make gen-opaque         Print a new OPAQUE server setup string"
	@echo "  make gen-session-secret Print a 48-byte base64 random value"
	@echo "  make gen-admin-key      Print a 48-byte base64 random value"
	@echo "  make gen-notify-key     Print a 48-byte base64 random value"
	@echo ""
	@echo "Examples:"
	@echo "  make secrets >> .env.prod"
	@echo "  ENV_FILE=.env.prod make secrets-init"

secrets:
	@printf 'OPAQUE_SERVER_SETUP=%s\n' "$$(cd packages/backend && ./node_modules/.bin/opaque create-server-setup | tr -d '\n')"
	@printf 'SESSION_SECRET=%s\n' "$$(openssl rand -base64 48 | tr -d '\n')"
	@printf 'ADMIN_KEY=%s\n' "$$(openssl rand -base64 48 | tr -d '\n')"
	@printf 'NOTIFY_ENCRYPTION_KEY=%s\n' "$$(openssl rand -base64 48 | tr -d '\n')"

secrets-init:
	@if [ -e $(ENV_FILE) ]; then \
		echo "Refusing to overwrite existing $(ENV_FILE). Append manually with: make secrets >> $(ENV_FILE)"; \
		exit 1; \
	fi
	@$(MAKE) --no-print-directory secrets > $(ENV_FILE)
	@chmod 600 $(ENV_FILE)
	@echo "Wrote 4 secrets to $(ENV_FILE) (mode 600)."

gen-opaque:
	@cd packages/backend && ./node_modules/.bin/opaque create-server-setup

gen-session-secret:
	@openssl rand -base64 48 | tr -d '\n'; echo

gen-admin-key:
	@openssl rand -base64 48 | tr -d '\n'; echo

gen-notify-key:
	@openssl rand -base64 48 | tr -d '\n'; echo
