import assert from "node:assert/strict";
import test from "node:test";

import { assessHybridEditionRequest } from "../lib/hybrid-edition-request-guard.ts";

const current = {
  selectedEditionId: "edition-current",
  currentEditionId: "edition-current",
  selectorFellBack: false,
  exactHistoricalDossierBound: false,
};

test("Hybrid current URL remains unchanged without an edition parameter", () => {
  assert.equal(assessHybridEditionRequest({ ...current, requestedParam: undefined }), "CURRENT");
  assert.equal(assessHybridEditionRequest({ ...current, requestedParam: "edition-current" }), "CURRENT");
});

test("Hybrid never silently displays current when an explicit edition is invalid", () => {
  for (const requestedParam of ["missing-edition", "", " ", ["edition-current", "missing-edition"]]) {
    assert.equal(assessHybridEditionRequest({ ...current, requestedParam, selectorFellBack: true }), "INVALID_REQUEST");
  }
  assert.equal(assessHybridEditionRequest({ ...current, requestedParam: "missing-edition" }), "INVALID_REQUEST");
});

test("valid historical edition requires a bound, exact frozen Dossier", () => {
  const historical = {
    selectedEditionId: "edition-old",
    currentEditionId: "edition-current",
    requestedParam: "edition-old",
    selectorFellBack: false,
  };
  assert.equal(assessHybridEditionRequest({ ...historical, exactHistoricalDossierBound: false }), "HISTORICAL_DOSSIER_UNAVAILABLE");
  assert.equal(assessHybridEditionRequest({ ...historical, exactHistoricalDossierBound: true }), "HISTORICAL_READY");
});

test("a missing current index must not promote an explicit request to history", () => {
  assert.equal(assessHybridEditionRequest({
    selectedEditionId: null,
    currentEditionId: null,
    requestedParam: "edition-old",
    selectorFellBack: true,
    exactHistoricalDossierBound: false,
  }), "INVALID_REQUEST");
});
