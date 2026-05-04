#!/usr/bin/env python3
"""
Detect and delete duplicate files in the model-images Supabase bucket.
A "duplicate" is defined as: two or more files in the same folder that
share the same base name after stripping a leading timestamp/UUID prefix.

Example:
  digitals/4/1714000000000-headshot.jpg   <-- older upload
  digitals/4/1714999999999-headshot.jpg   <-- newer upload  (DUPLICATE of above)

Only the OLDEST copy is deleted; the newest is kept.
The script prints a dry-run report first; deletion is opt-in.
"""

import json, re, sys, urllib.request, urllib.error
from collections import defaultdict

SUPABASE_URL = "https://jjmmakbnjzzxbuflucck.supabase.co"
SERVICE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impq"
    "bW1ha2Juanp6eGJ1Zmx1Y2NrIiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjAx"
    "MzQzNCwiZXhwIjoyMDkxNTg5NDM0fQ"
    ".Bjn1wl_XGzTwOBLEh6HkwY5IA_BANv2Dm9pVQ1LWWSE"
)
BUCKET = "model-images"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": "Bearer " + SERVICE_KEY,
    "Content-Type": "application/json",
}

# Prefix patterns we strip to find the "canonical" base name
# e.g.  1714000000000-photo.jpg  ->  photo.jpg
#        abc123def456-photo.jpg  ->  photo.jpg  (UUID prefix)
PREFIX_STRIP = re.compile(
    r"^(?:\d{10,13}|[0-9a-f]{8,32})[_\-]", re.IGNORECASE
)


def api_post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        SUPABASE_URL + path, data=data, headers=HEADERS, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode()[:200]}"


def list_folder(prefix):
    result, err = api_post(
        f"/storage/v1/object/list/{BUCKET}",
        {"prefix": prefix, "limit": 1000, "offset": 0,
         "sortBy": {"column": "created_at", "order": "asc"}},
    )
    if err:
        print(f"  ERROR listing '{prefix}': {err}")
        return []
    return result or []


def delete_files(paths):
    result, err = api_post(
        f"/storage/v1/object/{BUCKET}",
        {"prefixes": paths},
    )
    if err:
        print(f"  DELETE ERROR: {err}")
        return False
    return True


def canonical(name):
    """Strip leading timestamp/UUID prefix to get the base name."""
    return PREFIX_STRIP.sub("", name)


def walk_bucket():
    """Return a list of all file paths in the bucket."""
    files = []

    def recurse(prefix):
        entries = list_folder(prefix)
        for entry in entries:
            name = entry.get("name", "")
            full = (prefix + "/" + name).lstrip("/")
            if entry.get("id"):          # it's a file
                files.append({"path": full, "entry": entry})
            else:                        # it's a pseudo-folder
                recurse(full)

    recurse("")
    return files


def main(dry_run=True):
    print("Scanning bucket …")
    all_files = walk_bucket()
    print(f"Total files found: {len(all_files)}")

    if not all_files:
        print("Nothing to do.")
        return

    # Group files by folder, keyed by canonical base name
    by_folder_and_base = defaultdict(list)
    for f in all_files:
        path = f["path"]
        folder, _, fname = path.rpartition("/")
        base = canonical(fname)
        by_folder_and_base[(folder, base)].append(f)

    to_delete = []
    print("\n--- Duplicate groups ---")
    found_any = False
    for (folder, base), group in sorted(by_folder_and_base.items()):
        if len(group) < 2:
            continue
        found_any = True
        print(f"\n  Folder: {folder or '(root)'}  |  base: {base}")
        # Sort by created_at ascending so the oldest is first
        group_sorted = sorted(
            group,
            key=lambda x: x["entry"].get("created_at") or x["path"],
        )
        for i, f in enumerate(group_sorted):
            tag = "KEEP (newest)" if i == len(group_sorted) - 1 else "DELETE (older)"
            print(f"    [{tag}] {f['path']}")
        # Mark all except the last (newest) for deletion
        to_delete.extend(f["path"] for f in group_sorted[:-1])

    if not found_any:
        print("  No duplicates detected.")
        return

    print(f"\nFiles to delete: {len(to_delete)}")
    for p in to_delete:
        print(f"  {p}")

    if dry_run:
        print("\n[DRY RUN] No files deleted. Re-run with --delete to apply.")
        return

    # Delete in batches of 100
    batch_size = 100
    deleted = 0
    for i in range(0, len(to_delete), batch_size):
        batch = to_delete[i : i + batch_size]
        ok = delete_files(batch)
        if ok:
            deleted += len(batch)
            print(f"  Deleted batch {i // batch_size + 1} ({len(batch)} files)")
        else:
            print(f"  Failed to delete batch {i // batch_size + 1}")

    print(f"\nDone. Deleted {deleted} / {len(to_delete)} duplicate files.")


if __name__ == "__main__":
    dry_run = "--delete" not in sys.argv
    main(dry_run=dry_run)
