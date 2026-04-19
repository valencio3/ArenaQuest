# Task 03: R2 Storage Adapter (implement `IStorageAdapter`)

## Metadata
- **Status:** Pending
- **Complexity:** Medium
- **Milestone:** 3 — Content & Media Core
- **Dependencies:** none (port already exists)

---

## Summary

Provide a working concrete implementation of `IStorageAdapter` backed by Cloudflare R2.
R2 exposes both a native binding (for in-Worker put/get) **and** an S3-compatible HTTP
endpoint (required for presigned URLs). This adapter uses both: the binding for
server-side operations and S3 signing (`@aws-sdk/s3-request-presigner`) for the
presigned URL flow.

---

## Technical Constraints

- **Ports/Adapters:** the adapter file is the **only** place R2- or S3-SDK imports
  appear. A grep test enforces this.
- **Isolation:** the adapter receives `{ bucket: R2Bucket, s3Config: { … } }` via the
  constructor — nothing is read from globals.
- **Credentials:** R2 access-key pair is stored as Worker secrets
  (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`); the account-level S3 endpoint is in
  `wrangler.jsonc` as a plain var (`R2_S3_ENDPOINT`).
- **Presign scope:** presigned PUT URLs encode `Content-Type` and `Content-Length` so
  the browser cannot upload a different MIME than claimed.
- **Public URLs:** only issued when the bucket has public access; otherwise the adapter
  throws.

---

## Scope

### 1. Dependencies

```jsonc
// apps/api/package.json — dependencies
"@aws-sdk/client-s3": "^3.650",
"@aws-sdk/s3-request-presigner": "^3.650"
```

These imports are confined to the adapter file.

### 2. Bindings — `apps/api/wrangler.jsonc`

```jsonc
"r2_buckets": [
  { "binding": "R2", "bucket_name": "arenaquest-media" }
],
"vars": {
  "R2_S3_ENDPOINT": "https://<account>.r2.cloudflarestorage.com",
  "R2_PUBLIC_BASE": "https://<public>.r2.dev"
}
// Secrets set via `wrangler secret put`:
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
```

Update `AppEnv` in `apps/api/src/index.ts`.

### 3. Adapter — `apps/api/src/adapters/storage/r2-storage-adapter.ts`

```ts
export class R2StorageAdapter implements IStorageAdapter {
  constructor(private readonly deps: {
    bucket: R2Bucket;
    s3Endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBase?: string;
  }) {}
  // ... implement every method
}
```

Implementation notes:
- `putObject` / `getObject` / `deleteObject` / `headObject` use the native `R2Bucket`
  binding (no HTTP round-trip, no S3 signing).
- `getPresignedUploadUrl` uses `@aws-sdk/s3-request-presigner` with
  `PutObjectCommand`, enforcing `ContentType`, `ContentLength`.
- `getPresignedDownloadUrl` uses `GetObjectCommand` + presigner.
- `getPublicUrl` builds `{publicBase}/{key}` or throws if `publicBase` is unset.

### 4. Tests

Because R2 has no local emulator in the Workers test pool, the adapter tests use a
**fake `R2Bucket`**: a simple `Map<string, { body, metadata }>` that satisfies the
subset of the `R2Bucket` interface we touch. Unit test coverage:
- put/get/delete round-trip on the fake.
- `objectExists`, `headObject` positive + negative.
- `listObjects` returns cursor-based pagination.
- `getPresignedUploadUrl` returns a URL with `X-Amz-Signature` and an `expires-in`
  component near the requested value (string assertion).
- `getPublicUrl` throws when no `publicBase` is configured.

### 5. Wire into `buildApp`

Instantiate `R2StorageAdapter` alongside the other adapters. Do not expose it on any
route yet — consumers arrive in Tasks 05 and 06.

---

## Acceptance Criteria

- [ ] Adapter implements every method of `IStorageAdapter`.
- [ ] The adapter is the sole importer of `@aws-sdk/*` and `@cloudflare/workers-types`
      (for R2 types) in the app — enforced by a grep check in the test suite.
- [ ] `wrangler.jsonc` declares the `R2` binding, `R2_S3_ENDPOINT`, and `R2_PUBLIC_BASE`.
- [ ] Unit tests listed in §4 pass against a fake `R2Bucket`.
- [ ] Instantiating the adapter with missing credentials throws at construction time
      (fail-fast).
- [ ] `make cf-typegen` produces a type file that includes `R2` as `R2Bucket`.
- [ ] `make lint` clean; all tests pass.

---

## Verification Plan

1. `pnpm --filter api test` — green.
2. Manual in `wrangler dev`: run a one-off script that calls `putObject` / `getObject`
   round-trip.
3. Manual presign: call `getPresignedUploadUrl("test.bin", { expiresInSeconds: 60 })`,
   `curl -X PUT ...` with the returned URL, then `getObject("test.bin")` returns the
   uploaded bytes.
