import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import supertest from 'supertest';
import { TestDatabaseContainer } from '../setup/testcontainers';
import { closePrismaConnections, truncateTestData } from './test-seed';

type HttpClient = ReturnType<typeof supertest>;

/**
 * Boots a fresh Nest application backed by the Testcontainers Postgres instance.
 * - Applies the same global ValidationPipe and whitelist rules as main.ts.
 * - Exposes helper methods for Supertest requests and graceful teardown.
 */
export async function createTestingApp(): Promise<{
  app: INestApplication;
  http: HttpClient;
}> {
  // Ensure the container (and migrations) are ready before the Nest app spins up.
  await TestDatabaseContainer.start();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const httpClient = supertest(app.getHttpServer());
  return {
    app,
    http: httpClient,
  };
}

/**
 * Cleans all relational data so each test starts with an empty database
 * while keeping the Postgres container alive for the next spec.
 */
export async function resetDatabase(): Promise<void> {
  await truncateTestData();
}

/**
 * Closes all open resources at the end of the suite.
 * Should be called in afterAll once createTestingApp() is used.
 */
export async function destroyTestingApp(app: INestApplication): Promise<void> {
  await app.close();
  await closePrismaConnections();
  await TestDatabaseContainer.stop();
}