# Posts system MEAN App 

A web app based posts dashboard including users authentication and authrization, and images storage logic.

## Repository layout

```
apps/server   NestJS + TypeScript API (MongoDB via Mongoose)
libs/shared   TypeScript types shared by the API and (later) the Angular client
apps/client   Angular 22 client: standalone components, signals, Material 3, typed reactive forms
```

This is a [pnpm](https://pnpm.io/) workspace (`corepack enable` picks the pinned version). Node ^22.22.3 or >=24.15 is required by Angular 22 (`.nvmrc` says 24).

## Installing

1. `git clone https://github.com/yotamach/MeanStack-App.git && cd MeanStack-App`
2. `pnpm install`
3. `cp .env.example .env` and set `JWT_SECRET` (and `MONGODB_URI` if not using the compose Mongo)
4. `docker compose up -d` to start a local MongoDB

## Running the app

1. `pnpm start:server` - API on http://localhost:3000/api (builds `libs/shared` first)
2. `pnpm start` - Angular client on http://localhost:4200 (proxies `/api` and `/images` to the API, see `apps/client/proxy.conf.json`)

## Checks

- `pnpm test` - client unit tests (Vitest)
- `pnpm lint` - lint the client (angular-eslint)
- `pnpm build` - production build of the client
- `pnpm typecheck:server` - type-check the API
- `pnpm build:server` - compile the API to `apps/server/dist`

## Deployment

`pnpm build` writes the client to `apps/client/dist/client`. Serve it behind a reverse proxy that forwards `/api` and `/images` to the API (the client calls relative URLs).

## Built With

* [Angular](https://angular.dev/) - The web framework used
* [mongoDB](https://www.mongodb.com/) - Dependency Management
* [nodeJS](https://nodejs.org/) - The server side lang
* [Express](https://expressjs.com/) - The backend framework

## Authors

* **Yotal Achrak**
Experianced FullStack developer, working with Abgular, NodeJS, PHP, ES6 
* *private projects* - [GitHub accound](https://github.com/yotamach)
* *LinkedIn* - [LinkedIn profile](www.linkedin.com/in/yotam-achrak-717b6555)

## License

This project is licensed under the MIT License.

## Enjoy!


