/**
 * Approved private creator-intelligence universe, in retrieval priority order.
 * Shared by discovery, transcript selection and legacy worker claimability.
 * SQL claim parity is a separate deployment gate; this is not proof of intake.
 * This list does not grant public publication or change canonical source rules.
 */
export const CREATOR_CHANNELS = [
  {
    "key": "stockedup",
    "name": "StockedUp",
    "handle": "@StockedUp",
    "env": "YOUTUBE_CHANNEL_ID_STOCKEDUP"
  },
  {
    "key": "wall-street-truth-bombs",
    "name": "Wall Street Truthbombs",
    "handle": "@wstruthbombs",
    "env": "YOUTUBE_CHANNEL_ID_WALL_STREET_TRUTH_BOMBS"
  },
  {
    "key": "fx-evolution",
    "name": "FX Evolution",
    "handle": "@fxevolutionvideo",
    "env": "YOUTUBE_CHANNEL_ID_FX_EVOLUTION"
  },
  {
    "key": "traders-reality",
    "name": "Traders Reality",
    "handle": "@TradersReality",
    "env": "YOUTUBE_CHANNEL_ID_TRADERS_REALITY"
  },
  {
    "key": "tradernick",
    "name": "TraderNick",
    "handle": "@TraderNick",
    "env": "YOUTUBE_CHANNEL_ID_TRADERNICK"
  },
  {
    "key": "real-eisman-playbook",
    "name": "Real Eisman Playbook",
    "handle": "@RealEismanPlaybook",
    "env": "YOUTUBE_CHANNEL_ID_REAL_EISMAN_PLAYBOOK"
  },
  {
    "key": "meetkevin",
    "name": "MeetKevin",
    "handle": "@MeetKevin",
    "env": "YOUTUBE_CHANNEL_ID_MEETKEVIN"
  },
  {
    "key": "casual-finance",
    "name": "Casual Finance",
    "handle": "@casuallyfinance",
    "env": "YOUTUBE_CHANNEL_ID_CASUAL_FINANCE"
  },
  {
    "key": "fireship",
    "name": "Fireship / Code Report",
    "handle": "@Fireship",
    "env": "YOUTUBE_CHANNEL_ID_FIRESHIP"
  },
  {
    "key": "thewhyx",
    "name": "TheWhyX",
    "handle": "@TheWhyX",
    "env": "YOUTUBE_CHANNEL_ID_THEWHYX"
  },
  {
    "key": "clearvalue-tax",
    "name": "ClearValueTax",
    "handle": "@clearvaluetax9382",
    "env": "YOUTUBE_CHANNEL_ID_CLEARVALUE_TAX",
    "officialChannelId": "UCigUBIf-zt_DA6xyOQtq2WA"
  }
] as const;

export type CreatorChannelKey = typeof CREATOR_CHANNELS[number]["key"];
export const CREATOR_CHANNEL_PRIORITY = CREATOR_CHANNELS.map(channel => channel.key);
export const CREATOR_PUBLISHERS = CREATOR_CHANNELS.map(channel => channel.name);
