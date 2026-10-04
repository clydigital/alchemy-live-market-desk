# P1.7 Presenter Historical Replay End-to-End Proof

P1.7 closes the Presenter/Journey historical replay chain with an executable proof.

## Proven chain

```
Dossier N is current at publication
  -> presenter-dossier-edition-context/1 freezes Dossier N ID + as_of
  -> Journey edition N freezes Story reasoning version N
  -> current Dossier advances to N+1
  -> current Story reasoning advances to N+1
  -> user selects Journey edition N
  -> frozen Dossier N identity is recovered
  -> exact immutable Dossier N is loaded by UUID
  -> Dossier ID and as_of are revalidated
  -> historical expectation / tape / divergence come from Dossier N
  -> historical explanation / mechanisms / next test / falsification come from Story version N
  -> Presenter scope = HISTORICAL_FULL_CASE
```

No current N+1 Dossier or Story reasoning is allowed to leak into that replayed Presenter case.

## Legacy-edition behaviour

An older Journey edition without `presenterDossierContext` can still replay its frozen Story reasoning.

Because there is no exact Dossier identity, Presenter remains:

`HISTORICAL_STORY_REASONING_ONLY`

Expectation, tape, divergence and missing-evidence context continue to come from the current Dossier, and the UI states that boundary explicitly.

## Exactness rules

Full historical replay requires all of the following:

- selected historical Journey edition;
- valid `presenter-dossier-edition-context/1`;
- `BOUND` frozen context;
- valid Dossier UUID;
- exact historical Dossier lookup by that UUID;
- reader status `historical_exact`;
- returned Dossier ID equals frozen ID;
- returned Dossier `selectedAsOf` equals frozen `dossierAsOf`;
- exact Story/version reasoning identity from the selected edition.

Failure of any Dossier identity requirement keeps replay in Story-only mode.

## Architecture boundary

P1.7 adds no new runtime behaviour beyond P1.6. It is proof/documentation only.

The historical Presenter path remains read-only and does not:

- run Research Brain;
- create a new reasoning engine;
- mutate Market Dossier V2;
- mutate Story state;
- create a Story thesis version;
- republish an edition;
- infer a historical Dossier from timestamp, latest state, Story linkage, thesis linkage or prose.
