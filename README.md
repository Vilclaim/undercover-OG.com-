# GetNbuy Pro E-Commerce Website

## What is included
- Professional Amazon-style front end
- Backend API using Node.js + Express
- SQLite database
- Admin dashboard
- Add / edit / delete products
- Order management
- Cart and checkout
- WhatsApp order message

## How to run

1. Install Node.js from https://nodejs.org
2. Open this folder in VS Code
3. Open Terminal
4. Run:

```bash
npm install
npm start
```

5. Open:

```text
http://localhost:3000
```

## Admin panel

Open:

```text
http://localhost:3000/admin.html
```

## Change WhatsApp number

Open `server.js`, find:

```js
const WHATSAPP_NUMBER = "971504238543";
```

Change it to your own number.
