import json
import os
import urllib.error
import urllib.request

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

url = os.getenv("SUPABASE_URL", "").strip()
key = (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_KEY") or "").strip()
table = (os.getenv("SUPABASE_METRICS_TABLE") or "api_request_metrics").strip()

endpoint = f"{url}/rest/v1/{table}"
payload = {
    "endpoint": "/api/chat",
    "status_code": 200,
    "response_time_ms": 123,
    "message_length": 10,
    "is_stream": False,
    "error_code": "",
    "error_message": "",
    "client_ip": "127.0.0.1",
}

req = urllib.request.Request(
    endpoint,
    data=json.dumps(payload).encode("utf-8"),
    method="POST",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
)

try:
    with urllib.request.urlopen(req, timeout=8) as response:
        print("status", response.status)
        print(response.read().decode("utf-8"))
except urllib.error.HTTPError as exc:
    print("http_error", exc.code)
    print(exc.read().decode("utf-8", errors="ignore"))
except Exception as exc:
    print("error", repr(exc))
