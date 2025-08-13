#!/bin/bash

set -e

# Load environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../.env"

curl --request POST \
     --url https://us-west-2.recall.ai/api/v1/bot/ \
     --header "Authorization: $RECALLAI_API_KEY" \
     --header "accept: application/json" \
     --header "content-type: application/json" \
     --data "{
  \"meeting_url\": \"$ZOOM_MEETING_URL\",
  \"bot_name\": \"Transcribe Bot (WebSocket)\",
  \"recording_config\": {
    \"transcript\": {
      \"provider\": {
        \"meeting_captions\": {}
      }
    },
    \"realtime_endpoints\": [
      {
        \"type\": \"websocket\",
        \"url\": \"$WS_URL\",
        \"events\": [\"transcript.data\"]
      }
    ]
  }
}"
