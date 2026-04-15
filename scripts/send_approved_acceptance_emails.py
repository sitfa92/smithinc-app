from pathlib import Path
import json
import urllib.request
import urllib.error


def load_env(path=".env"):
    env = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"')
    return env


def main():
    env = load_env()
    service_key = env["SUPABASE_SERVICE_ROLE_KEY"]
    supabase_base = env["VITE_SUPABASE_URL"].rstrip("/")

    query_url = (
        f"{supabase_base}/rest/v1/models"
        "?select=id,name,email,status"
        "&status=eq.approved"
        "&order=submitted_at.desc"
    )

    req = urllib.request.Request(
        query_url,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept": "application/json",
        },
    )

    with urllib.request.urlopen(req) as response:
        approved_rows = json.loads(response.read().decode())

    unique_rows = []
    seen_emails = set()
    for row in approved_rows:
        email = (row.get("email") or "").strip().lower()
        if not email or email in seen_emails:
            continue
        seen_emails.add(email)
        unique_rows.append(row)

    sent = []
    failed = []

    for row in unique_rows:
        payload = {
            "type": "model-status",
            "data": {
                "name": row.get("name") or "there",
                "email": row.get("email") or "",
                "status": "approved",
                "digitalsLink": f"https://meet-serenity.online/digitals/{row.get('id')}",
            },
        }

        email_req = urllib.request.Request(
            "https://meet-serenity.online/api/send-email",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Origin": "https://meet-serenity.online",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(email_req) as response:
                body = json.loads(response.read().decode())
                sent.append(
                    {
                        "name": row.get("name"),
                        "email": row.get("email"),
                        "status": response.status,
                        "sentTo": body.get("sentTo"),
                    }
                )
        except urllib.error.HTTPError as error:
            failed.append(
                {
                    "name": row.get("name"),
                    "email": row.get("email"),
                    "status": error.code,
                    "body": error.read().decode(),
                }
            )
        except Exception as error:
            failed.append(
                {
                    "name": row.get("name"),
                    "email": row.get("email"),
                    "error": str(error),
                }
            )

    print(json.dumps({
        "approvedUnique": len(unique_rows),
        "sentCount": len(sent),
        "failedCount": len(failed),
        "sent": sent,
        "failed": failed,
    }, indent=2))


if __name__ == "__main__":
    main()
