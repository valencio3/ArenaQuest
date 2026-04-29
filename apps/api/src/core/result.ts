type Ok<T> = { ok: true; data: T };
type Err = { ok: false; status: number; error: string; meta?: Record<string, unknown> };
export type ControllerResult<T> = Ok<T> | Err;
