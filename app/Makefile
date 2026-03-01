GO ?= go
WAILS_CMD ?= $(GO) run github.com/wailsapp/wails/v2/cmd/wails@v2.11.0
WAILS_PROJECT_DIR ?= ./cmd/app
RUNTIME_DIR ?= ../runtime

.PHONY: env-check fmt test tidy build run wails-dev wails-build clean

env-check:
	$(GO) version

fmt:
	$(GO) fmt ./...

test:
	$(GO) test ./...

tidy:
	$(GO) mod tidy

build:
	mkdir -p $(RUNTIME_DIR)
	CGO_LDFLAGS="-framework UniformTypeIdentifiers" $(GO) build -tags production -o $(RUNTIME_DIR)/app ./cmd/app

run: build
	$(RUNTIME_DIR)/app

wails-dev:
	cd $(WAILS_PROJECT_DIR) && $(WAILS_CMD) dev -s

wails-build:
	mkdir -p $(RUNTIME_DIR)
	cd $(WAILS_PROJECT_DIR) && $(WAILS_CMD) build -s
	cd $(WAILS_PROJECT_DIR) && cp -R ./build/bin/*.app ../../../runtime/
	rm -rf $(WAILS_PROJECT_DIR)/build

clean:
	rm -f $(RUNTIME_DIR)/app
	rm -rf $(RUNTIME_DIR)/*.app
	rm -rf $(WAILS_PROJECT_DIR)/build
	rm -rf ./cmd/runtime
