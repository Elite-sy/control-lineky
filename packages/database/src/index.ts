import prisma from './client';

export { prisma as db };
export { PrismaClient, Prisma } from '@prisma/client';
export type * from '@prisma/client';
