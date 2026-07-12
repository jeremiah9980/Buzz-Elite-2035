#!/usr/bin/env python3
"""
Import an NCS schedule into a GameChanger team using a local logged-in Chrome profile.

This is intentionally local-only. It does not store credentials and does not use an
undocumented API. It opens the NCS schedule, extracts upcoming games, then opens the
GameChanger team schedule and fills the Add Game form one game at a time.

Examples:
  python ncs-monitor/ncs_to_gamechanger.py \
    --ncs-url "https://www.playncs.com/Fastpitch/..." \
    --gc-team-url "https://web.gc.com/teams/TEAM_ID/.../schedule" \
    --headful --dry-run

  python ncs-monitor/ncs_to_gamechanger.py \
    --ncs-url "https://www.playncs.com/Fastpitch/..." \
    --gc-team-url "https://web.gc.com/teams/TEAM_ID/.../schedule" \
    --headful --confirm
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Iterable

try:
    from bs4 import BeautifulSoup
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    sys.exit("Missing dependencies. Run: pip install beautifulsoup4 selenium webdriver-manager")

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "ncs-monitor" / "reports"
OUT_DIR.mkdir(parents=True, exist_ok=True)

if sys.platform == "darwin":
    DEFAULT_PROFILE = Path.home() / "Library/Application Support/Google/Chrome/Default"
elif sys.platform.startswith("win"):
    DEFAULT_PROFILE = Path.home() / "AppData/Local/Google/Chrome/User Data/Default"
else:
    DEFAULT_PROFILE = Path.home() / ".config/google-chrome/Default"

PROFILE_SKIP = {
    "Cache", "Code Cache", "GPUCache", "Service Worker", "DawnCache",
    "DawnGraphiteCache", "DawnWebGPUCache", "ShaderCache", "GrShaderCache",
    "OptimizationGuide", "Download Service", "blob_storage", "IndexedDB",
    "File System", "Safe Browsing",
}

DATE_PATTERNS = [
    "%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%b %d, %Y", "%B %d, %Y",
]
TIME_PATTERNS = ["%I:%M %p", "%I %p", "%H:%M"]


@dataclass
class Game:
    date: str
    time: str
    opponent: str
    location: str = ""
    home_away: str = ""
    tournament: str = ""
    source: str = ""


def log(message: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}", flush=True)


def clone_profile(src: Path) -> Path:
    if not src.exists():
        sys.exit(f"Chrome profile not found: {src}\nOpen chrome://version and pass its Profile Path with --profile.")
    dst = Path(tempfile.mkdtemp(prefix="ncs_gc_profile_")) / "Default"
    def ignore(_path: str, names: list[str]) -> set[str]:
        return {n for n in names if n in PROFILE_SKIP or n.endswith((".tmp", ".lock"))}
    shutil.copytree(src, dst, ignore=ignore, dirs_exist_ok=True)
    return dst


def driver_for(profile: Path, headful: bool) -> webdriver.Chrome:
    opts = Options()
    if not headful:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1440,1100")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument(f"--user-data-dir={profile.parent}")
    opts.add_argument(f"--profile-directory={profile.name}")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)


def normalize_date(value: str) -> str:
    text = re.sub(r"\s+", " ", value.strip())
    for fmt in DATE_PATTERNS:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    m = re.search(r"(\d{1,2}/\d{1,2}/\d{2,4})", text)
    if m:
        return normalize_date(m.group(1))
    return ""


def normalize_time(value: str) -> str:
    text = re.sub(r"\s+", " ", value.strip()).upper().replace(".", "")
    for fmt in TIME_PATTERNS:
        try:
            return datetime.strptime(text, fmt).strftime("%I:%M %p").lstrip("0")
        except ValueError:
            pass
    m = re.search(r"(\d{1,2}:\d{2}\s*(?:AM|PM))", text, re.I)
    return normalize_time(m.group(1)) if m else ""


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def rows_from_table(table) -> Iterable[list[str]]:
    for tr in table.select("tr"):
        cells = [clean_text(c.get_text(" ", strip=True)) for c in tr.select("th,td")]
        if cells:
            yield cells


def parse_ncs_html(html: str, source_url: str) -> list[Game]:
    soup = BeautifulSoup(html, "html.parser")
    games: list[Game] = []
    seen: set[tuple[str, str, str]] = set()

    for table in soup.select("table"):
        rows = list(rows_from_table(table))
        if len(rows) < 2:
            continue
        headers = [h.lower() for h in rows[0]]
        for cells in rows[1:]:
            record = {headers[i]: cells[i] if i < len(cells) else "" for i in range(len(headers))}
            combined = " | ".join(cells)
            date = ""
            for key, value in record.items():
                if "date" in key:
                    date = normalize_date(value)
                    break
            if not date:
                date = normalize_date(combined)
            if not date:
                continue

            time_value = ""
            for key, value in record.items():
                if "time" in key:
                    time_value = normalize_time(value)
                    break
            if not time_value:
                time_value = normalize_time(combined)

            opponent = ""
            for key, value in record.items():
                if any(token in key for token in ("opponent", "matchup", "team")) and "your" not in key:
                    opponent = value
                    break
            if not opponent:
                non_date = [c for c in cells if not normalize_date(c) and not normalize_time(c)]
                opponent = non_date[0] if non_date else "Opponent TBD"

            location = ""
            for key, value in record.items():
                if any(token in key for token in ("location", "field", "venue", "park")):
                    location = value
                    break

            home_away = ""
            low = combined.lower()
            if " away " in f" {low} " or low.startswith("at ") or " @ " in combined:
                home_away = "away"
            elif " home " in f" {low} " or " vs " in f" {low} ":
                home_away = "home"

            key = (date, time_value, clean_text(opponent).lower())
            if key in seen:
                continue
            seen.add(key)
            games.append(Game(date, time_value, clean_text(opponent), clean_text(location), home_away, "", source_url))

    # Fallback for card/list-based schedules.
    if not games:
        for node in soup.select("article, .game, .schedule-item, .event, li"):
            text = clean_text(node.get_text(" ", strip=True))
            date = normalize_date(text)
            if not date:
                continue
            time_value = normalize_time(text)
            opponent = text
            key = (date, time_value, opponent.lower())
            if key not in seen:
                seen.add(key)
                games.append(Game(date, time_value, opponent, source=source_url))

    games.sort(key=lambda g: (g.date, g.time))
    return games


def save_manifest(games: list[Game]) -> Path:
    path = OUT_DIR / "ncs-gamechanger-import.json"
    payload = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "game_count": len(games),
        "games": [asdict(g) for g in games],
    }
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return path


def find_click(driver, labels: list[str], timeout: int = 8):
    for label in labels:
        xpath = (
            "//*[self::button or self::a or @role='button']"
            f"[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{label.lower()}')]"
        )
        try:
            el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((By.XPATH, xpath)))
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
            return el
        except Exception:
            continue
    return None


def fill_by_labels(driver, labels: list[str], value: str) -> bool:
    if not value:
        return True
    for label in labels:
        selectors = [
            f"input[aria-label*='{label}' i]", f"input[placeholder*='{label}' i]",
            f"textarea[aria-label*='{label}' i]", f"textarea[placeholder*='{label}' i]",
        ]
        for selector in selectors:
            for el in driver.find_elements(By.CSS_SELECTOR, selector):
                try:
                    el.clear(); el.send_keys(value); return True
                except Exception:
                    pass
        xpath = f"//label[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'{label.lower()}')]"
        for lab in driver.find_elements(By.XPATH, xpath):
            try:
                target = lab.get_attribute("for")
                el = driver.find_element(By.ID, target) if target else lab.find_element(By.XPATH, ".//following::input[1]")
                el.clear(); el.send_keys(value); return True
            except Exception:
                pass
    return False


def add_game(driver, gc_team_url: str, game: Game, confirm: bool) -> tuple[bool, str]:
    driver.get(gc_team_url)
    time.sleep(2.5)
    add = find_click(driver, ["add game", "new game", "create game"])
    if not add:
        return False, "Could not find Add Game button"
    add.click(); time.sleep(1.5)

    fill_by_labels(driver, ["opponent", "team name"], game.opponent)
    fill_by_labels(driver, ["date"], game.date)
    fill_by_labels(driver, ["time", "start time"], game.time)
    fill_by_labels(driver, ["location", "venue", "field"], game.location)

    if not confirm:
        return True, "Form populated only"

    save = find_click(driver, ["save game", "create game", "add game", "save"])
    if not save:
        return False, "Form populated, but Save button was not found"
    save.click(); time.sleep(2)
    return True, "Created"


def main() -> None:
    ap = argparse.ArgumentParser(description="Import NCS schedule games into a GameChanger team.")
    ap.add_argument("--ncs-url", required=True)
    ap.add_argument("--gc-team-url", required=True)
    ap.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="Extract and preview games only")
    ap.add_argument("--confirm", action="store_true", help="Actually click Save/Create for each game")
    ap.add_argument("--future-only", action="store_true", default=True)
    args = ap.parse_args()

    profile = clone_profile(args.profile)
    driver = driver_for(profile, args.headful)
    results = []
    try:
        log(f"Opening NCS schedule: {args.ncs_url}")
        driver.get(args.ncs_url)
        time.sleep(3)
        games = parse_ncs_html(driver.page_source, args.ncs_url)
        today = datetime.now().date().isoformat()
        if args.future_only:
            games = [g for g in games if not g.date or g.date >= today]
        manifest = save_manifest(games)
        log(f"Found {len(games)} games. Manifest: {manifest}")
        for g in games:
            print(f"  {g.date} {g.time:>8} | {g.opponent} | {g.location}")

        if args.dry_run or not args.confirm:
            log("Dry run complete. Re-run with --confirm to create games.")
            return

        for game in games:
            ok, note = add_game(driver, args.gc_team_url, game, confirm=True)
            results.append({**asdict(game), "success": ok, "note": note})
            log(f"{'OK' if ok else 'ERROR'} {game.date} {game.opponent}: {note}")

        result_path = OUT_DIR / "ncs-gamechanger-import-results.json"
        result_path.write_text(json.dumps({"results": results}, indent=2) + "\n")
        log(f"Results written: {result_path}")
    finally:
        driver.quit()
        shutil.rmtree(profile.parent, ignore_errors=True)


if __name__ == "__main__":
    main()
