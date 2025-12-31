# SEL Server Dockerfile - Rust Automation Engine
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconfig

WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create dummy src to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && mkdir -p src/bin && echo "fn main() {}" > src/bin/server.rs

# Build dependencies (cached layer)
RUN cargo build --release --features server

# Copy actual source
COPY . .

# Touch files to invalidate cache and rebuild with real source
RUN touch src/lib.rs src/bin/server.rs

# Build the actual binary
RUN cargo build --release --features server

# Runtime stage - minimal alpine image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/sel-server /app/sel-server

# Run as non-root user
RUN adduser -D -u 1000 sel
USER sel

EXPOSE 3030

ENV RUST_LOG=sel_server=info,tower_http=info

CMD ["/app/sel-server"]
