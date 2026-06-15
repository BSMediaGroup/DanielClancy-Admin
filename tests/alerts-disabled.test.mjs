import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminApp = readFileSync(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
const alertSender = readFileSync(new URL("../functions/_shared/alert-sender.js", import.meta.url), "utf8");

test("Alerts nav is removed and direct route shows only the disabled notice", () => {
  assert.doesNotMatch(adminApp, /\{\s*id:\s*"alerts",\s*label:\s*"Alerts"/);
  assert.match(adminApp, /Alert rules are managed in StreamSuites-Dashboard only\./);
  assert.match(adminApp, /DanielClancy-Admin cannot create, edit, delete, import, reset, reconcile, export, sync, or save StreamSuites alert rule definitions\./);
});

test("Alerts route no longer exposes rule editor controls", () => {
  const renderAlertsMatch = adminApp.match(/function renderAlerts\(\) \{[\s\S]*?\n  \}/);
  assert.ok(renderAlertsMatch, "renderAlerts function should exist for direct route notice");
  const renderAlerts = renderAlertsMatch[0];
  assert.doesNotMatch(renderAlerts, /data-alert-action="create"/);
  assert.doesNotMatch(renderAlerts, /data-alert-action="copy-json"/);
  assert.doesNotMatch(renderAlerts, /data-alert-action="import-json"/);
  assert.doesNotMatch(renderAlerts, /data-alert-action="reset"/);
  assert.doesNotMatch(renderAlerts, /renderAlertTable/);
  assert.doesNotMatch(renderAlerts, /renderAlertModal/);
});

test("Admin alert sender strips rule definition fields recursively", () => {
  assert.doesNotMatch(alertSender, /api\/admin\/alerts\/configuration/);
  assert.match(alertSender, /RULE_DEFINITION_FIELDS/);
  assert.match(alertSender, /"configuration"/);
  assert.match(alertSender, /"schema_version"/);
  assert.match(alertSender, /eventObjectOnly\(event\.payload\)/);
  assert.match(alertSender, /eventObjectOnly\(event\.context\)/);
});
