#!/usr/bin/env python3
"""
NCS -> schedule.json scraper for the CTX Bombers Meza dashboard.

Pulls the NCS event Schedule & Results page, parses the game table once NCS
posts the schedule/results, and writes data/schedule.json in the shape the
NCS tracker can consume.

Run locally:   python scraper/ncs_scrape.py
In CI:         invoked by .github/workflows/ncs-update.yml every few minutes.

Note: playncs.com must be reachable from wherever this runs. GitHub Actions
runners have open internet, so it works there even though some sandboxes block it.
"""

import json, re, sys, datetime, pathlib
import requests
from bs4 import BeautifulSoup

# ----------------------------------------------------------------------
TEAM_ID = "79552"
EVENT = {
    "name": "3P Sports Dingers for Dads *6GG*",
    "dates": "Jun 20-21, 2026",
    "location": "Taylor/Lorena, TX",
    "venue": "Taylor/Lorena",
    "director": "Jennifer Anderson",
    "gateFees": "See NCS event page",
    "division": "10U",
    "teamId": "26-79552",
    "teamName": "CTX Bombers Meza",
    "teamUrl": "https://www.playncs.com/fastpitch/Teams/Details/79552/ctx-bombers-meza",
    "url": "https://playncs.com/FASTPITCH/Events/Schedule/12287/3p-sports-dingers-for-dads-6gg?division=10U",
}
SCHEDULE_URL = EVENT["url"]

# Map the weekday tokens NCS prints to real calendar dates for this event.
DATE_MAP = {"Fri": "2026-06-19", "Sat": "2026-06-20", "Sun": "2026-06-21"}

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "schedule.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (CTXBombersMeza NCS sync)"}

TIME_RE = re.compile(r"(\d{1,2}:\d{2}\s*[AP]M)", re.I)
GAME_RE = re.compile(r"Game\s+(\d+)", re.I)
DAY_RE  = re.compile(r"\b(Sat|Sun|Fri)\b")
ID_RE   = re.compile(r"/Teams/Details/(\d+)/")
INT_RE  = re.compile(r"\b(\d{1,2})\b")


def to_iso(day, time_str):
    """'Sat' + '9:00 AM' -> '2026-06-20T09:00:00' (24h local)."""
    date = DATE_MAP.get(day, "2026-06-20")
    try:
        t = datetime.datetime.strptime(time_str.upper().replace(" ", ""), "%I:%M%p")
        return f"{date}T{t.strftime('%H:%M:%S')}"
    except ValueError:
        return f"{date}T00:00:00"


def parse_team_cell(td):
    """Return (team_id, team_name, score|None) from a team <td>."""
    a = td.find("a")
    if not a:
        return None, td.get_text(strip=True), None
    tid_m = ID_RE.search(a.get("href", ""))
    tid = tid_m.group(1) if tid_m else None
    name = a.get_text(strip=True)
    # Score = any standalone integer left in the cell after removing the link text.
    leftover = td.get_text(" ", strip=True).replace(name, " ")
    sc_m = INT_RE.search(leftover)
    score = int(sc_m.group(1)) if sc_m else None
    return tid, name, score


def scrape():
    r = requests.get(SCHEDULE_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # Find the schedule table (header row mentions Field + Team).
    table = None
    for t in soup.find_all("table"):
        head = t.get_text(" ", strip=True).lower()
        if "field" in head and "team" in head:
            table = t
            break
    if table is None:
        raise RuntimeError("Schedule table not found — NCS may not have posted the schedule yet, or markup changed.")

    games, teams = [], {}
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 6:
            continue
        meta = tds[0].get_text(" ", strip=True)
        gm_m = GAME_RE.search(meta)
        if not gm_m:
            continue
        game_no = int(gm_m.group(1))
        day_match = DAY_RE.search(meta)
        day = day_match.group(1) if day_match else "Sat"
        time_m = TIME_RE.search(tds[1].get_text(" ", strip=True)) or TIME_RE.search(meta)
        time_str = time_m.group(1).upper().replace(" ", " ") if time_m else "TBD"

        field_a = tds[2].find("a")
        field = (field_a.get_text(strip=True) if field_a else tds[2].get_text(strip=True))
        field = re.sub(r"^(Taylor Athletic Complex)\s*", "TAC ", field) or field
        field = re.sub(r"\s+", " ", field).strip()

        h_id, h_name, h_sc = parse_team_cell(tds[3])
        a_id, a_name, a_sc = parse_team_cell(tds[5])
        if not h_id or not a_id:
            continue
        for tid, nm in ((h_id, h_name), (a_id, a_name)):
            teams.setdefault(tid, nm)

        status = "final" if (h_sc is not None and a_sc is not None) else "scheduled"
        games.append({
            "id": game_no, "gameNo": game_no, "day": day,
            "dateISO": to_iso(day, time_str), "time": time_str, "field": field,
            "homeId": h_id, "awayId": a_id,
            "home": h_name, "away": a_name,
            "homeScore": h_sc, "awayScore": a_sc, "status": status,
        })

    games.sort(key=lambda g: (g["dateISO"], g["gameNo"]))
    payload = {
        "event": EVENT,
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "myTeamId": TEAM_ID,
        "teams": [{"id": tid, "name": nm,
                   "guest": nm.strip().endswith("*")} for tid, nm in teams.items()],
        "games": games,
    }
    return payload


def main():
    data = scrape()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    finals = sum(1 for g in data["games"] if g["status"] == "final")
    print(f"Wrote {OUT} — {len(data['games'])} games "
          f"({finals} final), {len(data['teams'])} teams.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:               # never crash the Action on a transient blip
        print(f"[scrape error] {e}", file=sys.stderr)
        sys.exit(1)
