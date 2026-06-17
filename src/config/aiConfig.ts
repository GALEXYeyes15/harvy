/**
 * Harvy AI model configuration — single source of truth.
 *
 * Claude Sonnet 4.6 is the current default generation model.
 * Future model upgrades should only require changing DEFAULT_MODEL (and provider
 * settings below if the new model uses a different API).
 */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

/** Anthropic Messages API version header value. */
export const ANTHROPIC_API_VERSION = "2023-06-01";

/** Default max output tokens for JSON generation jobs (proofread, format outputs). */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

/** Environment variable name for the Anthropic API key. */
export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY";
