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

- Unit tests are added under `src/app/core/auth/__tests__` using the Angular testing utilities and HttpClientTestingModule.
