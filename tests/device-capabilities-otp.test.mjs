import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("email OTP input supports operating-system one-time-code autofill", () => {
  const app = read("../app/app.js");
  assert.match(app, /autocomplete = 'one-time-code'/);
  assert.match(app, /inputMode = 'numeric'/);
  assert.match(app, /pattern = '\[0-9\]\{6\}'/);
});

test("OTP requests and resends use a 60-second resend cooldown", () => {
  const app = read("../app/app.js");
  assert.match(app, /startOtpResendCooldown\(60\)/);
  assert.match(app, /Reenviar código \(' \+ remaining \+ 's\)/);
  assert.match(app, /Date\.now\(\) < resendCooldownUntil/);
});

test("device permissions are explicit and GPS supports live position tracking", () => {
  const html = read("../app/index.html");
  const device = read("../app/device-capabilities.js");
  assert.match(html, /device-capabilities\.js/);
  assert.match(device, /Notification\.requestPermission/);
  assert.match(device, /navigator\.geolocation\.watchPosition/);
  assert.match(device, /navigator\.geolocation\.getCurrentPosition/);
});

test("signup email OTP verification uses the email token type", () => {
  const cloud = read("../app/cloud.js");
  assert.match(cloud, /verifyOtp\(\{ email: normalizedEmail, token: code, type: 'email' \}\)/);
  assert.doesNotMatch(cloud, /type: otpType === 'email' \? 'email' : 'signup'/);
});
