import "server-only";

/**
 * Server-side entry point for the file-based content library.
 *
 * The implementation lives in `./fs-loader` so that Node scripts can use it
 * too; this module adds the `server-only` guard for application code.
 */
export * from "./fs-loader";
