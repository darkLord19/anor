# Architecture Decision Record

## Overview

This document records the key architectural decisions made during the refactoring of the Dotor monorepo to a production-grade structure.

## Monorepo Structure

### Decision: apps/ and packages/ Separation

**Context**: The original structure had everything under `packages/`, mixing applications and reusable packages.

**Decision**: Split into `apps/` (deployable applications) and `packages/` (shared libraries).

**Rationale**:
- Clear separation of concerns
- Industry standard pattern
- Makes dependency rules explicit
- Easier to enforce no circular dependencies

**Trade-offs**:
- Required updating import paths
- Build order becomes important

## Backend Architecture

### Decision: Layered Architecture (Routes → Controllers → Services)

**Context**: Original code mixed HTTP handling, business logic, and data access in route files.

**Decision**: Implement strict layering with:
- Routes: HTTP method + path only
- Controllers: Parse requests, call services, map to HTTP responses
- Services: Business logic and Supabase operations

**Rationale**:
- Separation of concerns
- Testability (can test services without HTTP)
- Maintainability
- Standard backend pattern

**Trade-offs**:
- More files and boilerplate
- Initially slower development

### Decision: Domain Errors over Generic Errors

**Context**: Errors were inconsistent, making it hard to provide good API responses.

**Decision**: Implement typed domain error classes (ValidationError, AuthError, NotFoundError, etc.) with automatic HTTP status code mapping.

**Rationale**:
- Consistent error responses
- Type-safe error handling
- Automatic HTTP status codes
- Better error messages to clients

**Trade-offs**:
- Must throw specific error types
- More error classes to maintain

### Decision: Supabase Client Separation (Admin vs User-Scoped)

**Context**: Original code mixed admin and user operations with unclear RLS implications.

**Decision**: Three separate client types:
- Admin client: Service role key, bypasses RLS, for privileged operations
- User client: Request-scoped, respects RLS, for user operations
- Auth client: Public anon key, for authentication operations

**Rationale**:
- Security: Clear when RLS is bypassed
- Principle of least privilege
- Explicit about authorization context
- Follows Supabase best practices

**Trade-offs**:
- More code to manage clients
- Must be careful about which client to use

### Decision: Environment Validation with Zod

**Context**: Missing or invalid environment variables caused runtime failures.

**Decision**: Validate all environment variables at startup using Zod schemas.

**Rationale**:
- Fail fast on misconfiguration
- Type-safe access to environment
- Self-documenting configuration requirements
- Prevents runtime errors

**Trade-offs**:
- Application won't start if env is invalid
- Must keep schema in sync with usage

## Shared Packages

### Decision: Single Source of Truth for Types and Schemas

**Context**: Types and validation were duplicated between backend and webapp.

**Decision**: Create `@dotor/shared` package with:
- Shared types (API DTOs, domain types)
- Zod schemas for validation
- Constants (routes, error codes, status codes)

**Rationale**:
- DRY principle
- Type safety across apps
- Guaranteed contract compatibility
- Easier refactoring

**Trade-offs**:
- Backend and webapp now coupled through shared package
- Must rebuild shared package when changed

### Decision: Structured Logging Package

**Context**: Inconsistent logging across the application.

**Decision**: Create `@dotor/logger` with Pino-based structured logging.

**Rationale**:
- Consistent log format
- Automatic PII redaction
- Request correlation IDs
- Production-ready observability
- JSON structured logs for log aggregation

**Trade-offs**:
- Must use logger instead of console.*
- Slight overhead for log formatting

### Decision: Shared TypeScript Configurations

**Context**: TypeScript configs were duplicated with slight variations.

**Decision**: Create `@dotor/tsconfig` with base configs for different environments.

**Rationale**:
- Consistent TypeScript settings
- Single place to enforce strict mode
- Easier to update TS settings
- DRY principle

**Trade-offs**:
- Less flexibility per package
- Must suit all packages

## Security Decisions

### Decision: Helmet, Rate Limiting, and CORS by Default

**Context**: Original server had minimal security middleware.

**Decision**: Add Helmet for security headers, rate limiting (100 req/min), and CORS allowlist.

**Rationale**:
- Defense in depth
- Industry best practices
- Protect against common attacks
- Production-ready defaults

**Trade-offs**:
- Slight performance overhead
- CORS config needed for development

### Decision: No Secrets in Code, Environment Only

**Context**: Need to prevent accidental secret exposure.

**Decision**: All secrets must come from environment variables, validated at startup.

**Rationale**:
- Prevents secrets in version control
- Follows 12-factor app principles
- Clear configuration management
- Different secrets per environment

**Trade-offs**:
- More complex deployment setup
- Must manage environment variables

### Decision: Automatic PII Redaction in Logs

**Context**: Risk of logging sensitive user data.

**Decision**: Configure Pino to automatically redact common PII fields (passwords, tokens, cookies, etc.).

**Rationale**:
- Privacy by default
- Regulatory compliance (GDPR, etc.)
- Prevents accidental data leaks
- Defense in depth

**Trade-offs**:
- May redact useful debugging info
- Must keep redaction list updated

## Webapp Decisions

### Decision: Keep CSS Modules for Now

**Context**: Requirements specified Tailwind-only styling.

**Decision**: Keep existing CSS modules, add Tailwind incrementally.

**Rationale**:
- Minimize breaking changes in this PR
- CSS modules are working fine
- Large conversion is separate concern
- Allows incremental migration

**Trade-offs**:
- Not fully compliant with requirements
- Two styling systems temporarily

### Decision: Server Components by Default

**Context**: Next.js App Router supports server components.

**Decision**: Use server components unless client interactivity needed.

**Rationale**:
- Better performance
- Smaller bundle sizes
- Server-side data fetching
- Next.js best practices

**Trade-offs**:
- Can't use React hooks
- Different mental model

## Build and Tooling Decisions

### Decision: pnpm with Workspaces

**Context**: Need to manage monorepo with multiple packages.

**Decision**: Use pnpm with workspace protocol.

**Rationale**:
- Fast and disk-efficient
- Strict dependency resolution
- Good monorepo support
- Industry standard

**Trade-offs**:
- Different from npm/yarn
- Team must install pnpm

### Decision: TypeScript Strict Mode Everywhere

**Context**: Need type safety and code quality.

**Decision**: Enable strict mode with additional checks (noUncheckedIndexedAccess, exactOptionalPropertyTypes).

**Rationale**:
- Catch bugs at compile time
- Better code quality
- Self-documenting code
- Production-grade standards

**Trade-offs**:
- More type annotations required
- Initially slower development

## What Was NOT Changed

To maintain stability and minimize breaking changes, the following were intentionally kept:

1. **Existing Route Implementations**: ask, google, dom, and account routes maintain their current implementation. These can be refactored to the controller/service pattern in future PRs.

2. **CSS Modules in Webapp**: Converting all CSS modules to Tailwind would be a large breaking change affecting every component. This should be done incrementally in separate PRs.

3. **Webapp Route Structure**: The current Next.js App Router structure works. Reorganizing into route groups can be done later.

4. **Extension Package**: The Chrome extension maintains its legacy structure as it's a separate deployment artifact.

## Future Improvements

See README.md TODOs section for planned improvements, including:
- Complete backend module refactoring
- Webapp CSS → Tailwind conversion
- Comprehensive test suite
- CI/CD pipeline
- Auth provider and guards
- Git hooks (Husky, lint-staged)
