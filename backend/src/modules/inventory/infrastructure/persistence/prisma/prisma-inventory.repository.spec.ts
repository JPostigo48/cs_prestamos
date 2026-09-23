import { describe, it, expect, vi } from 'vitest';
import { PrismaInventoryRepository } from './prisma-inventory.repository.js';

describe('PrismaInventoryRepository', () => {
  it('should delegate findAllResources to prisma sql builder', async () => {
    const query = { sql: 'SELECT 1' };
    const runtime = { query: vi.fn().mockResolvedValue([{ id: 'a' }]) };

    const queryBuilder = {
      where: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue(query),
    };

    const prisma = {
      sql: {
        public: {
          recursos: {
            select: vi.fn().mockReturnValue(queryBuilder),
          },
        },
      },
      client: {
        runtime: vi.fn().mockReturnValue(runtime),
      },
    };

    const repository = new PrismaInventoryRepository(prisma as any);
    const result = await repository.findAllResources();

    expect(prisma.sql.public.recursos.select).toHaveBeenCalled();
    expect(queryBuilder.build).toHaveBeenCalled();
    expect(runtime.query).toHaveBeenCalledWith(query);
    expect(result).toEqual([{ id: 'a' }]);
  });
});
