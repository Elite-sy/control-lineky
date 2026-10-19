import { PrismaClient } from '@prisma/client';

// PgBouncer configuration for connection pooling
// This ensures compatibility with Supabase's connection pooler
const prismaClientSingleton = () => {
  // Skip Prisma instantiation during build if DATABASE_URL is not set
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set, skipping Prisma Client initialization');
    return null as unknown as PrismaClient;
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
