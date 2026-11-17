# AI Engineering Course — Module 1

A NestJS backend with one endpoint, `POST /chat`, that calls an LLM.

## Setup
```bash
npm install
cp .env.example .env      # placeholder key → mock mode
npm run start:dev
```

## Try it
```bash
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' \
  -d '{"system":"Be concise.","messages":[{"role":"user","content":"Hi"}]}'
```

## Exercise
Call `/chat` twice. On the second call, send the first reply back as an
`assistant` message followed by a new `user` message. That is "memory" by hand.
With a real key, compare `usage.inputTokens` across calls: it grows each turn
because the whole history is resent.

## To verify once you have a key
- The exact model ID (`LLM_MODEL`).
- Whether the chosen model accepts `temperature` (only sent when the request includes it).
