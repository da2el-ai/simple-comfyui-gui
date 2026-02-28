GO ?= go

.PHONY: env-check fmt test tidy build clean

env-check:
	$(GO) version

fmt:
	$(GO) fmt ./...

test:
	$(GO) test ./...

tidy:
	$(GO) mod tidy

build:
	mkdir -p ../runtime/bin
	CGO_LDFLAGS="-framework UniformTypeIdentifiers" $(GO) build -tags production -o ../runtime/bin/app ./cmd/app

clean:
	rm -rf ../runtime/bin
