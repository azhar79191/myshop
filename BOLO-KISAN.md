# Bolo Kisan voice enquiries

This feature uses the existing React/Node/MongoDB stack. It does not use speech recognition, text-to-speech, an AI model, n8n, or an external voice service. It records messages and plays human-recorded Punjabi instructions. It cannot understand arbitrary spoken questions.

## Activate Punjabi speech

1. Deploy the backend and frontend together, including the microphone Permissions-Policy change in vercel.json.
2. Sign in as a superadmin and open **Voice enquiries** (`/admin/voice`).
3. Choose **Record voice** to record the displayed welcome script, or **Upload audio** to select an existing recording. Preview it and save it. Supported uploads: MP3, WAV, M4A/MP4, WebM and OGG, up to 3 MB.
4. Select **Message received**, record that script, and save it.
5. On the public site open **Bolo Kisan** and press **Listen**. Audio requires a user gesture; browsers may block automatic playback after submission, so the Listen button remains available.

No male voice asset is bundled. The assistant reports when prompts have not been recorded. Recording a prompt replaces the existing one. Prompt audio is public; never include private information in it.

Suggested welcome script (Roman Punjabi):
Assalam-o-Alaikum! Bismillah Spray Center wallon ji aayan nu. Fasal, product ya spray wala button dabao. Mic dabao te apna masla dasso. Fer roko, apna phone number likho te bhejo wala button dabao. Saadi team tuhanu phone karegi.

Suggested confirmation:
Tuhada paigham sanu mil gaya ae. Mehrbani! Saadi team tuhanu chheti phone karegi.

## Farmer and staff flow

Farmers select a picture category, record up to 60 seconds, listen, enter a Pakistani mobile number and send. Staff refresh the private inbox, listen, call back and mark replied. This version supports callback replies, not public retrieval of staff audio replies. The inbox shows the latest 100 messages. There is no automatic deletion or external notification delivery.

Recordings are stored as bounded binary fields in the existing database; no additional storage provider is required. Include these collections in existing database retention and backup policies. Farmer audio endpoints require existing staff authentication. Only superadmins may change public prompts. Uploads are limited to 3 MB and checked for supported container signatures; malformed media may still be unplayable because no media decoder is installed.

## Verification

- Frontend: ESLint on changed components and `npm run build`.
- Backend: `node --test test/voice.test.js` checks supported audio signatures, private route authentication, form validation, successful storage payloads and oversized upload rejection using a stubbed database write.
- Before production: test a real microphone and both prompt recordings on Android Chrome and iPhone Safari, verify MongoDB persistence, callback handling and staff playback. Real-device audio and production persistence have not been verified by automated tests.
