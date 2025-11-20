# Workshop Backend

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">A NestJS backend with authentication, session management, and PostgreSQL database for workshop management.</p>

## Description

This is a [NestJS](https://github.com/nestjs/nest) framework TypeScript application that provides a complete backend solution for workshop management with user authentication and session handling.

## Setup

### Prerequisites
- **Node.js (v18 or higher)**  
  Required to run the NestJS backend and Prisma CLI.

- **Docker & Docker Compose**  
  Required to run the PostgreSQL database locally in a container.  
  Make sure Docker Desktop (or Docker Engine) is running before you start the backend.

- **npm**  
  Comes with Node.js, used for installing dependencies and running scripts.

### Installation

1. **Clone and install**
```bash
git clone <repository-url>
cd workshop-backend
npm install
```

2. **Setup environment**
```bash
cp .env.example .env
#  Open .env and set your DATABASE_URL if needed
```

3. **Start database and app**
```bash
docker-compose up -d
```

4. **Run database migrations and generate the Prisma client**
```bash
npx prisma migrate dev
```

5. **(Optional) Seed the database**
```bash
npx prisma db seed
```

6. **(Optional) Open Prisma Studio to view/manage the database**
```bash
npx prisma studio
```

7. **Start the backend server**
```bash
npm run start:dev
```

### API Access

- The backend API runs at:  
`http://localhost:3000`

- All endpoints are versioned under:  
`/api/v1/`

- **Interactive API documentation (Swagger UI):**  
[http://localhost:3000/docs](http://localhost:3000/docs)  
Use this to explore, test, and understand all available endpoints.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login and receive a JWT
### Sessions
- `POST /api/v1/sessions` — Create a session (requires moderator JWT)
- `POST /api/v1/sessions/join` — Join a session (public, returns participant token)
- `GET /api/v1/sessions/{id}` — Get session details (moderator/researcher/admin JWT)
- `PATCH /api/v1/sessions/{id}/status` — Update session status (moderator/admin JWT, body: `{ "status": "LOBBY" | "RUNNING" | "ENDED" | "ABANDONED" }`)
- `GET /api/v1/sessions/{id}/participants` — List session participants (moderator/researcher/admin JWT)
- `POST /api/v1/sessions/{sessionId}/leave` — Leave a session (participant self-leave, body: `{ "token": "<participant_token>" }`)

- **Tip:**  
  Use Swagger UI to try out endpoints and see required request/response formats.

## Database Management

```bash
# View and edit the database in your browser
$ npx prisma studio

# Run database migrations (apply schema changes and generate Prisma client)
$ npx prisma migrate dev

# Seed the database with initial data (if a seed script is provided):
$ npx prisma db seed

# Regenerate the Prisma client (after changing the schema):
$ npx prisma generate
```

- The database connection string is configured in your `.env` file as `DATABASE_URL`.
- By default, the database runs in a Docker container started with `docker-compose up -d`.


## Docker Commands

```bash
# Start services
$ docker-compose up -d

# Stop all services
$ docker-compose down

# View logs for all services
$ docker-compose logs -f

# Check running containers
$ docker ps

# Remove all stopped containers, networks, and images (cleanup)
$ docker system prune
```

- The default `docker-compose.yml` starts a PostgreSQL database container for development.
Make sure Docker Desktop (or Docker Engine) is running before using these commands.


### Compile and Run the Project


```bash
# Start the backend in normal development mode (no hot reload)
$ npm run start

# Start the backend in development mode (with hot reload)
$ npm run start:dev

# Start the backend in production mode
$ npm run start:prod

```

- The API will be available at http://localhost:3000
- Swagger UI (API docs) will be available at http://localhost:3000/docs

## Testing Overview

The backend uses Jest for testing and runs all integration and end-to-end tests against a PostgreSQL Testcontainer.
This setup mirrors production closely while keeping tests isolated, deterministic, and repeatable.

Tests are divided into three levels:

| Level | Description |
| --- | --- |
| Unit | Verifies service logic and edge cases with mocks (no DB). |
| Integration | Validates controllers, DTOs, and Prisma persistence with a temporary Postgres container. |
| E2E | Boots the full NestJS app and runs happy-path workflows. |

## Jest Commands Cheat Sheet

- All unit/integration tests: `npm run test`
- Watch mode while developing: `npm run test:watch`
- Single spec file: `npm run test -- --runTestsByPath test/integration/sessions/manage.integration.spec.ts`
- Multiple specs by pattern: `npm run test -- --testPathPattern="authentication|sessions"` (any valid Jest regex works)
- All tests with coverage: `npm run test:cov`
- Single file with coverage: `npm run test -- --runTestsByPath src/authentication/authentication.service.spec.ts --coverage`
- E2E suite: `npm run test:e2e` (uses `test/jest-e2e.json` and spins up the app with the test containers)

Coverage output lands in `coverage/` (configured via `jest.collectCoverageFrom`). Remember to keep Docker running so Prisma can reach PostgreSQL when tests touch the database.

## Using Jest in VS Code

If you’re using the Jest VS Code extension, you can:

- Run or debug individual tests directly from the code editor using the ▶️ icons.
- View test results inline, with real-time feedback and coverage indicators.
- Configure the Jest extension to pick up your environment automatically by setting the project’s root and using the default Jest configuration (`jest.config.ts`).

This approach lets you run single, multiple, or all tests visually without leaving VS Code, using the same Docker-backed Postgres test environment as the CLI commands.

**Tip:** Always ensure Docker is running before executing integration or e2e tests, as they depend on a Postgres container managed automatically by Testcontainers.


### Deployment

When you're ready to deploy your NestJS application to production:

- Review the official [NestJS deployment documentation](https://docs.nestjs.com/deployment) for best practices.
- Set environment variables for production (e.g., `DATABASE_URL`, `JWT_SECRET`, etc.).
- Build the project:
```bash
npm run build
```
- Start the server in production mode:
```bash
npm run start:prod
```
## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

---

