# Paymentology Credit

A static interactive article about how credit can adapt to unstable economic conditions. The project consists of an HTML page, CSS, JavaScript, and static images and fonts in `public/`.

## Getting Started

Node.js and npm are required.

- Install dependencies: `npm install`.
- Serve the source version locally: `python3 -m http.server 8000`, then open `http://localhost:8000`.
- Create a production build: `npm run build`. This clears and recreates `dist/`, minifies the HTML, CSS, and JavaScript, and copies `public/` into it.
- Preview the production build: `python3 -m http.server 8000 --directory dist`, then open `http://localhost:8000`.

