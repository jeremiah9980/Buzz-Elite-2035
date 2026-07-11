# Buzz Elite Integration Platform

This folder contains the backend contract for the enhanced CMS integration workspace.

## What the CMS now supports

- Search for an NCS team through a configured integration service.
- Preview and selectively import the NCS roster.
- Edit every player after import: photo path, name, number, position, biography, NCS player ID, and GameChanger player ID.
- Map website players to NCS and GameChanger identities.
- Configure a GameChanger team ID and season ID.
- Import authorized player statistics and attach them to player profiles.
- Configure multiple NCS team IDs for tournament discovery.
- Import registered events and create one tracker per event.
- Refresh event schedules and brackets on a 15-minute cron schedule.

## Important integration boundary

The public Buzz website and CMS are hosted on GitHub Pages. GitHub Pages is static hosting and cannot safely hold provider credentials, perform authenticated server-to-server requests, or run scheduled jobs. The companion Worker handles those responsibilities.

The included Worker deliberately ships with provider adapters disabled. NCS and GameChanger adapter functions must be connected to an authorized, documented data source, partner API, team-owned export, or other permitted integration. Do not add account passwords, session cookies, or browser automation intended to bypass provider controls.

## API contract

The CMS expects:

```text
GET  /api/health
GET  /api/ncs/teams?q=&division=&state=
GET  /api/ncs/teams/:teamId/roster
POST /api/ncs/events/sync
POST /api/ncs/events/:eventId/sync
POST /api/gamechanger/sync
GET  /api/config
POST /api/config
POST /api/sync/run
```

### Roster response

```json
[
  {
    "id": "ncs-player-id",
    "name": "Player Name",
    "number": "12",
    "position": "SS / OF",
    "photo": "images/players/player-name.jpg"
  }
]
```

### Tournament event response

```json
[
  {
    "id": "event-id",
    "name": "Tournament Name",
    "startDate": "2026-07-18",
    "location": "Austin, TX",
    "status": "registered",
    "lastSyncedAt": "2026-07-11T15:00:00Z",
    "games": [
      {
        "id": "game-id",
        "startTime": "2026-07-18T08:00:00-05:00",
        "field": "Field 3",
        "opponent": "Opponent",
        "bracket": "Pool A",
        "status": "scheduled"
      }
    ]
  }
]
```

### GameChanger stats response

```json
{
  "stats": {
    "gamechanger-player-id": {
      "games": 12,
      "plateAppearances": 34,
      "battingAverage": 0.412,
      "onBasePercentage": 0.481,
      "sluggingPercentage": 0.588,
      "hits": 14,
      "runs": 10,
      "rbi": 9
    }
  },
  "matches": [
    {
      "websitePlayerId": "player-id",
      "gameChangerPlayerId": "gc-player-id",
      "confidence": 1,
      "method": "explicit-id"
    }
  ]
}
```

## Cloudflare Worker deployment

```bash
cd integrations/worker
npm install -g wrangler
wrangler kv namespace create BUZZ_DATA
```

Add the returned namespace ID to `wrangler.toml`, then deploy:

```bash
wrangler deploy
```

Set the deployed Worker URL in:

```text
Buzz CMS → Integrations & Data Sync → Integration Settings
```

The cron expression in `wrangler.toml` runs every 15 minutes. Scheduled jobs may not execute at the exact second, so every sync should be idempotent and compare source timestamps before updating stored event data.

## Recommended player matching order

1. Explicit GameChanger player ID already stored on the website player.
2. Explicit NCS player ID mapped to a known GameChanger ID.
3. Normalized full name plus jersey number.
4. Normalized full name plus roster position.
5. Manual approval.

Never automatically accept a low-confidence match. Player names and jersey numbers can change, and siblings or teammates can share similar names.
