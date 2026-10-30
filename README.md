# Posts system MEAN App 

A web app based posts dashboard including users authentication and authrization, and images storage logic.

## Repository layout

```
apps/server   NestJS + TypeScript API (MongoDB via Mongoose)
libs/shared   TypeScript types shared by the API and (later) the Angular client
src/          Angular 6 client (to be replaced in Phase 2 of docs/IMPROVEMENT_PLAN)
```

This is a [pnpm](https://pnpm.io/) workspace (`corepack enable` picks the pinned version).

## Installing

1. `git clone https://github.com/yotamach/MeanStack-App.git && cd MeanStack-App`
2. `pnpm install`
3. `cp .env.example .env` and set `JWT_SECRET` (and `MONGODB_URI` if not using the compose Mongo)
4. `docker compose up -d` to start a local MongoDB

## Running the app

1. `pnpm start:server` - API on http://localhost:3000/api (builds `libs/shared` first)
2. `pnpm start` - Angular client on http://localhost:4200

## Checks

- `pnpm typecheck:server` - type-check the API
- `pnpm build:server` - compile the API to `apps/server/dist`

## Deployment

Run `pnpm build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Built With

* [Angular 6](https://angular.io/) - The web framework used
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


