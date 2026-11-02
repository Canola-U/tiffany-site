"""Extract PUBLIC Android Firebase options; never use a service-account key here."""
import json,sys
from pathlib import Path
source=json.loads(Path(sys.argv[1]).read_text())
if 'private_key' in source:
    raise SystemExit('This is a private server key. Do not upload or process it as Android app configuration.')
client=next((c for c in source['client'] if c['client_info'].get('android_client_info',{}).get('package_name')=='com.tiffanyroom.app'),None)
if not client:raise SystemExit('No Android client with package com.tiffanyroom.app was found.')
print(json.dumps({'appId':client['client_info']['mobilesdk_app_id'],'apiKey':client['api_key'][0]['current_key'],'projectId':source['project_info']['project_id'],'senderId':source['project_info']['project_number']},separators=(',',':')))
