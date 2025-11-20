import { TestDatabaseContainer } from './testcontainers';

jest.setTimeout(60000); // allow enough time for the image pull / container start

beforeAll(async () => {
  await TestDatabaseContainer.start();
});

afterAll(async () => {
  await TestDatabaseContainer.stop();
});

it('exposes a database url', () => {
  expect(TestDatabaseContainer.getDatabaseUrl()).toMatch(
    /^postgresql:\/\/postgres:postgres@/
  );
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: TestDatabaseContainer.getDatabaseUrl() } } });

  return prisma.$queryRaw`SELECT 1`
    .finally(async () => {
      await prisma.$disconnect();
    });
});
