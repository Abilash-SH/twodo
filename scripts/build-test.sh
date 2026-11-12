#!/bin/sh
# Test build against the local Firebase mock (tests/mock_firebase.py on 127.0.0.1:9000), served from the site root.
# Output: .test-out/  (serve it with:  python3 -m http.server 8003 --directory .test-out)
set -e
cd "$(dirname "$0")/.."
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_FIREBASE_API_KEY=test-key \
NEXT_PUBLIC_FIREBASE_DATABASE_URL=http://127.0.0.1:9000 NEXT_PUBLIC_AUTH_EMULATOR=http://127.0.0.1:9000 \
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BOY0fYzKVvY2ggvxwaINM57XjAkaaklOHPdsf01GC7tXiGOSlxZKVxR-SSOqhL6p3mkf_NNtfYpp0F0OdT4F5n4 \
npm run build
rm -rf .test-out && cp -r out .test-out
