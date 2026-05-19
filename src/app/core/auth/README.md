# Auth store

This module provides the centralized authentication store used by the UI.

Key points

- Stores `user`, `tenant`, `accessToken` and `refreshToken` as signals.
- Persists session to `sessionStorage` using Web Crypto AES-GCM encryption when available. If Web Crypto is not available, falls back to plain JSON.
- Automatically schedules a token refresh using the JWT `exp` claim (refresh is attempted 60s before expiry).
- Public API: `login(credentials)`, `logout()`, `refresh()`, `restoreFromStorage()`.

Security note - pure client-side dependant

- The implementation uses the browser Web Crypto API and stores an AES key in sessionStorage. This is a best-effort client-side encryption approach and does not replace secure server-side session management or secure key storage. For higher security requirements, keep sessions server-side or integrate an HSM/secure key store.

Tests

- Unit test added under `src/app/core/auth/` using the Angular testing utilities and HttpClientTestingModule.

# Authentication & Session Management Architecture

## Overview

This application uses a modern token-based authentication architecture built with:

- Angular Standalone Application
- NgRx Signal Store
- ASP.NET Core Web API
- JWT Access Tokens
- Refresh Tokens
- Session-based persistence
- Activity-based session management

The implementation is designed to support:

- Secure authentication
- Persistent login during active usage
- Automatic token refresh
- Automatic logout on inactivity
- Enterprise-style session lifecycle handling

---

# High-Level Architecture

```text
+------------------------------------------------------+
|                    Angular SPA                       |
|------------------------------------------------------|
| Login Component                                      |
| Auth Store (Signal Store)                            |
| Session Storage                                      |
| Activity Tracking                                    |
| Refresh Scheduler                                    |
| Idle Timeout Manager                                 |
+--------------------------|---------------------------+
                           |
                           | HTTP
                           v
+------------------------------------------------------+
|                 ASP.NET Core API                     |
|------------------------------------------------------|
| AuthController                                       |
| JWT Token Service                                    |
| Refresh Token Store                                  |
| User/Tenant Validation                               |
+------------------------------------------------------+
```

---

# Core Authentication Components

## Frontend (Angular)

### LoginComponent

Responsible for:

- Collecting credentials
- Calling authentication flow
- Redirecting after successful login

```ts
await this.auth.login(credentials);
```

---

### AuthStore (NgRx Signal Store)

Central authentication state manager.

Responsible for:

- Authentication state
- Token storage
- Session restoration
- Auto-refresh handling
- Activity tracking
- Idle timeout
- Logout handling

---

## Backend (.NET)

### AuthController

Endpoints:

| Endpoint             | Purpose              |
| -------------------- | -------------------- |
| `POST /auth/login`   | Authenticate user    |
| `POST /auth/refresh` | Refresh access token |

---

### JwtTokenService

Responsible for:

- Creating JWT access tokens
- Creating refresh tokens
- Adding claims
- Managing token expiration

Current access token expiration:

```csharp
DateTime.UtcNow.AddMinutes(30)
```

---

# Authentication Flow

## 1. User Login

User enters:

- Email
- Password

Frontend sends:

```http
POST /api/auth/login
```

Backend:

- Validates credentials
- Validates tenant/user status
- Generates JWT access token
- Generates refresh token

Response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {...},
  "tenant": {...}
}
```

---

## 2. Frontend Session Initialization

AuthStore:

- Stores tokens
- Stores user details
- Persists encrypted session
- Starts refresh scheduler
- Starts activity tracking

---

# Token Lifecycle

## Access Token

Purpose:

- Authenticate API requests

Characteristics:

| Property  | Value           |
| --------- | --------------- |
| Type      | JWT             |
| Lifetime  | 30 minutes      |
| Storage   | Session Storage |
| Stateless | Yes             |

---

## Refresh Token

Purpose:

- Generate new access tokens without forcing re-login

Characteristics:

| Property          | Value           |
| ----------------- | --------------- |
| Storage           | Session Storage |
| Rotation          | Supported       |
| Server Validation | Yes             |

---

# Session Persistence

## sessionStorage Usage

Authentication state is persisted in:

```ts
sessionStorage;
```

Stored data:

```ts
{
  (user, tenant, accessToken, refreshToken);
}
```

---

## Why sessionStorage?

Advantages:

- Cleared automatically when tab closes
- Safer than localStorage
- Prevents long-lived browser persistence
- Suitable for enterprise applications

Behavior:

| Scenario        | Result           |
| --------------- | ---------------- |
| Browser refresh | Session restored |
| Navigation      | Session retained |
| Tab close       | Session removed  |
| Browser restart | Session removed  |

---

# Automatic Token Refresh

## Purpose

Prevents users from being logged out while actively using the application.

---

## Refresh Scheduling

After login:

```ts
scheduleRefresh();
```

calculates:

```text
token_expiration - 60 seconds
```

Example:

| Event           | Time  |
| --------------- | ----- |
| Login           | 10:00 |
| Token Expiry    | 10:30 |
| Refresh Trigger | 10:29 |

---

## Refresh Flow

Frontend calls:

```http
POST /auth/refresh
```

Backend:

- Validates refresh token
- Loads user
- Generates new access token
- Generates new refresh token

Frontend:

- Updates state
- Re-persists session
- Re-schedules refresh

---

# Activity-Based Session Management

## Problem Solved

Without activity tracking:

- Background tabs could remain logged in forever
- Tokens would continuously refresh
- Inactive users would never expire

---

# Activity Tracking

The application tracks user interaction events:

```text
mousemove
mousedown
keydown
scroll
touchstart
click
visibilitychange
```

Every interaction updates:

```ts
lastActivityAt;
```

and resets the idle timer.

---

# Idle Timeout Logic

Configured timeout:

```ts
30 minutes
```

If no activity occurs within timeout:

```ts
performLogout();
```

executes automatically.

---

# Idle Session Lifecycle

## Active User

```text
10:00 Login
10:10 Mouse Movement
10:20 Typing
10:29 Token Refresh
10:35 Scrolling
```

Result:

✅ User remains logged in

---

## Inactive User

```text
10:00 Login
10:05 Last Activity
10:35 Idle Timeout Reached
```

Result:

✅ Automatic logout

---

# Refresh Suppression During Idle

Refresh scheduling is disabled when:

```ts
isIdle === true;
```

This prevents unnecessary token refreshes for inactive users.

---

# Session Restoration

On application startup:

```ts
restoreFromStorage();
```

performs:

1. Read persisted session
2. Restore store state
3. Resume activity tracking
4. Resume refresh scheduling

---

# Logout Mechanisms

## Manual Logout

Triggered by:

```ts
authStore.logout();
```

Actions:

- Clear tokens
- Clear session storage
- Clear refresh timers
- Clear idle timers

---

## Automatic Logout

Triggered when:

| Scenario                | Result          |
| ----------------------- | --------------- |
| Idle timeout reached    | Logout          |
| Refresh token invalid   | Logout          |
| Refresh API returns 401 | Logout          |
| Browser tab closed      | Session removed |

---

# Security Design

## Current Security Features

Implemented:

- JWT-based authentication
- Refresh tokens
- Session-scoped persistence
- Encrypted persisted state
- Automatic token rotation
- Idle session timeout

---

# Recommended Future Enhancements

## Refresh Token Expiration

Current implementation does not yet include refresh token expiry.

Recommended additions:

| Property   | Purpose              |
| ---------- | -------------------- |
| ExpiresAt  | Token expiration     |
| RevokedAt  | Manual revocation    |
| LastUsedAt | Activity tracking    |
| DeviceId   | Multi-device support |

---

## Recommended Refresh Token Model

```text
RefreshToken
  TokenHash
  UserId
  CreatedAt
  ExpiresAt
  LastUsedAt
  RevokedAt
  DeviceId
```

---

# Architectural Benefits

## Advantages of Current Design

### Scalability

- Stateless access tokens
- Lightweight frontend session handling

### Security

- Short-lived JWTs
- Idle timeout enforcement
- Session-scoped persistence

### User Experience

- Seamless token refresh
- No unnecessary re-login during active usage
- Automatic session recovery on page refresh

### Maintainability

- Centralized AuthStore
- Clear separation of concerns
- Signal-based reactive architecture

---

# Technology Stack

| Layer               | Technology        |
| ------------------- | ----------------- |
| Frontend            | Angular           |
| State Management    | NgRx Signal Store |
| Backend             | ASP.NET Core      |
| Authentication      | JWT               |
| Session Persistence | sessionStorage    |
| Reactive State      | Angular Signals   |

---

# Final Architecture Summary

```text
User Login
    ↓
Backend validates credentials
    ↓
JWT + Refresh Token issued
    ↓
AuthStore persists session
    ↓
Refresh scheduler starts
    ↓
Activity tracker starts
    ↓
User remains active
    ↓
Tokens refresh automatically
    ↓
If inactive for 30 mins
    ↓
Auto logout
```

---

# Conclusion

This authentication system provides a modern enterprise-ready authentication foundation with:

- JWT authentication
- Refresh token lifecycle
- Signal-based state management
- Session persistence
- Automatic refresh
- Activity-aware session handling
- Idle timeout enforcement

The design balances:

- Security
- Scalability
- User experience
- Maintainability

while remaining suitable for modern SPA + API enterprise applications.
