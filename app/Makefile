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
	$(GO) build -o ../runtime/bin/app ./cmd/app

clean:
	rm -rf ../runtime/bin
