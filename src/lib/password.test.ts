import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, hasRecoveryParams, isRateLimitError, validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("akzeptiert passende Passwörter ab Mindestlänge", () => {
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH), "a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
  it("lehnt zu kurze Passwörter ab", () => {
    expect(validateNewPassword("kurz", "kurz")).toMatch(/mindestens 8 Zeichen/);
    expect(validateNewPassword("1234567", "1234567")).not.toBeNull();
  });
  it("lehnt abweichende Wiederholung ab", () => {
    expect(validateNewPassword("langes-passwort", "langes-passwort2")).toMatch(/nicht überein/);
  });
  it("prüft zuerst die Länge", () => {
    expect(validateNewPassword("abc", "xyz")).toMatch(/mindestens/);
  });
});

describe("isRateLimitError", () => {
  it("erkennt Status 429, Code und Text", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ code: "over_email_send_rate_limit" })).toBe(true);
    expect(isRateLimitError({ message: "Email rate limit exceeded" })).toBe(true);
  });
  it("erkennt andere Fehler nicht", () => {
    expect(isRateLimitError({ status: 500, message: "boom" })).toBe(false);
  });
});

describe("hasRecoveryParams", () => {
  it("erkennt den Code (PKCE)", () => {
    expect(hasRecoveryParams("?code=abc", "")).toBe(true);
  });
  it("erkennt Tokens im Hash", () => {
    expect(hasRecoveryParams("", "#access_token=x&refresh_token=y&type=recovery")).toBe(true);
  });
  it("lehnt Fehler im Hash und fehlende Parameter ab", () => {
    expect(hasRecoveryParams("", "#error=access_denied&error_code=otp_expired")).toBe(false);
    expect(hasRecoveryParams("", "")).toBe(false);
    expect(hasRecoveryParams("", "#access_token=x&type=signup")).toBe(false);
  });
});
