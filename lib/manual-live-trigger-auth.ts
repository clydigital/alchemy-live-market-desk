import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

export const MANUAL_LIVE_TRIGGER_AUDIENCE = "alchemy-live-market-desk:manual-research";

const GITHUB_ACTIONS_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_ACTIONS_JWKS = createRemoteJWKSet(
  new URL(`${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`),
);
const TRUSTED_REPOSITORY = "clydigital/alchemy-live-market-desk";
const TRUSTED_REPOSITORY_ID = "1317040018";
const TRUSTED_REF = "refs/heads/main";
const TRUSTED_SUBJECT =
  "repo:clydigital@184374203/alchemy-live-market-desk@1317040018:ref:refs/heads/main";
const TRUSTED_WORKFLOW_REF =
  `${TRUSTED_REPOSITORY}/.github/workflows/run-live-research.yml@${TRUSTED_REF}`;

type VerificationKey = Parameters<typeof jwtVerify>[1];
type TrustedLiveTriggerEvent = "workflow_dispatch" | "schedule";

export type ManualLiveTriggerAuthorization =
  | {
      authorized: true;
      actor: string;
      githubRunId: string;
      workflowSha: string;
      eventName?: TrustedLiveTriggerEvent;
    }
  | { authorized: false };

function stringClaim(payload: JWTPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function acceptsLiveTriggerClaims(payload: JWTPayload, eventName: TrustedLiveTriggerEvent) {
  return payload.sub === TRUSTED_SUBJECT
    && stringClaim(payload, "repository") === TRUSTED_REPOSITORY
    && stringClaim(payload, "repository_id") === TRUSTED_REPOSITORY_ID
    && stringClaim(payload, "workflow_ref") === TRUSTED_WORKFLOW_REF
    && stringClaim(payload, "event_name") === eventName
    && stringClaim(payload, "ref") === TRUSTED_REF
    && stringClaim(payload, "ref_type") === "branch";
}

export function acceptsManualLiveTriggerClaims(payload: JWTPayload) {
  return acceptsLiveTriggerClaims(payload, "workflow_dispatch");
}

export function acceptsScheduledLiveTriggerClaims(payload: JWTPayload) {
  return acceptsLiveTriggerClaims(payload, "schedule");
}

async function verifyGitHubActionsLiveTrigger(
  request: Request,
  eventName: TrustedLiveTriggerEvent,
  verificationKey: VerificationKey,
): Promise<ManualLiveTriggerAuthorization> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  const token = match?.[1] || "";
  if (!token || token.length > 20_000) return { authorized: false };

  try {
    const { payload, protectedHeader } = await jwtVerify(token, verificationKey, {
      algorithms: ["RS256"],
      audience: MANUAL_LIVE_TRIGGER_AUDIENCE,
      issuer: GITHUB_ACTIONS_ISSUER,
      subject: TRUSTED_SUBJECT,
      clockTolerance: 5,
      maxTokenAge: "10m",
      requiredClaims: [
        "sub",
        "iat",
        "exp",
        "jti",
        "repository",
        "repository_id",
        "workflow_ref",
        "workflow_sha",
        "event_name",
        "ref",
        "ref_type",
        "actor",
        "run_id",
      ],
    });
    if (protectedHeader.typ !== "JWT" || !acceptsLiveTriggerClaims(payload, eventName)) {
      return { authorized: false };
    }

    return {
      authorized: true,
      actor: stringClaim(payload, "actor"),
      githubRunId: stringClaim(payload, "run_id"),
      workflowSha: stringClaim(payload, "workflow_sha"),
      eventName,
    };
  } catch {
    return { authorized: false };
  }
}

export async function verifyGitHubActionsManualLiveTrigger(
  request: Request,
  verificationKey: VerificationKey = GITHUB_ACTIONS_JWKS,
) {
  return verifyGitHubActionsLiveTrigger(request, "workflow_dispatch", verificationKey);
}

export async function verifyGitHubActionsScheduledLiveTrigger(
  request: Request,
  verificationKey: VerificationKey = GITHUB_ACTIONS_JWKS,
) {
  return verifyGitHubActionsLiveTrigger(request, "schedule", verificationKey);
}
