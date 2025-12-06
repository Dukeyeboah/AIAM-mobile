# Environment Variables Setup Guide

## Mobile App (.env file)

The mobile app **only needs** one environment variable:

```env
EXPO_PUBLIC_API_URL=https://www.aiam.space
```

This tells the mobile app where to find your web app's API endpoints.

## Web App (.env.local file)

Your web app's `.env.local` file should **stay exactly as it is**. You do NOT need to add `EXPO_PUBLIC_` prefixes to any of these variables because:

1. **Server-side only**: These keys (OpenAI, ElevenLabs, Replicate, etc.) are used server-side in your Next.js API routes
2. **Security**: These keys should NEVER be exposed to the client (mobile app or web browser)
3. **No changes needed**: Your existing `.env.local` is perfect as-is

### Your Current .env.local (Keep This As-Is)

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_AFFIRMATION_MODEL=gpt-4o-mini
OPENAI_IMAGE_PROMPT_MODEL=gpt-4o-mini

# Replicate (Nano-Banana)
REPLICATE_API_TOKEN=r8_...
REPLICATE_NANO_BANANA_VERSION=google/nano-banana

# ElevenLabs
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# Resend
RESEND_API_KEY=re_...

# Firebase (client-side config - safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ... etc

# Stripe
STRIPE_SECRET_KEY=sk_...  # Server-side only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...  # Client-side (safe)
# ... etc

# Firebase Admin (server-side only)
FIREBASE_PRIVATE_KEY=...
# ... etc
```

## How It Works

1. **Mobile app** calls: `https://www.aiam.space/api/text-to-speech`
2. **Your web app** receives the request at `/app/api/text-to-speech/route.ts`
3. **Your web app** uses `ELEVENLABS_API_KEY` from `.env.local` (server-side)
4. **Your web app** calls ElevenLabs API and returns audio to mobile app

The mobile app never sees or needs the API keys - they stay secure on your server!

## Summary

- ✅ Mobile app `.env`: Only needs `EXPO_PUBLIC_API_URL`
- ✅ Web app `.env.local`: Keep as-is, no changes needed
- ✅ API keys stay secure on server
- ✅ Mobile app calls your web app's API routes
