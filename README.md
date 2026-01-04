# MovieMaster Pro — Server

API for MovieMaster Pro: auth-protected movie CRUD, reviews, watchlist, profile, and stats.

## Features

- JWT (Firebase Admin) verification middleware
- Movies: query with search/filter/sort/pagination; add/update/delete (owner)
- Watchlist: add/remove/check per user
- Reviews: add, list by movie, list by user
- Users: create/fetch profile, update profile, summary stats endpoint
- CORS + JSON parsing, MongoDB with ObjectId validation

## Tech Stack

- Node.js, Express
- MongoDB (ServerApi v1)
- Firebase Admin (token verification)
- Dotenv, CORS

## Environment

Create `.env.local` (or `.env.production` on Vercel) with:
- `MONGODB_URI`
- `FIREBASE_SERVICE_KEY` (base64-encoded JSON service account)
- `NODE_ENV=production`

## Run Locally

1) `npm install`
2) `npm run start` (or `node server.js`)
3) API default: http://localhost:3000

## Deployment

- Hosted on Vercel; ensure env vars above are set in Project Settings.

## Screenshots

![API Logo](https://raw.githubusercontent.com/khandakershahi/moviemaster-pro-client/main/public/logo.png)
![UI Preview](https://raw.githubusercontent.com/khandakershahi/moviemaster-pro-client/main/public/screenshot.png)

## Links

- Live API: https://moviemaster-pro-server-gamma.vercel.app
- Repo: https://github.com/khandakershahi/moviemaster-pro-server
