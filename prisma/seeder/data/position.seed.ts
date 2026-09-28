import { PrismaClient } from '@prisma/client';

export const seedPositions = async (prisma: PrismaClient) => {
  console.log('📋 Seeding positions...');
  const adminPosition = await prisma.position.create({
    data: {
      name: 'ADMIN',
      description: 'Administrator keluarga dengan akses penuh termasuk kelola pengguna dan seluruh silsilah',
    },
  });

  const memberPosition = await prisma.position.create({
    data: {
      name: 'USER',
      description: 'Anggota keluarga dengan akses silsilah keluarga terbatas (2 generasi ke atas & keturunan)',
    },
  });

  console.log('✅ Positions seeded');
  return { adminPosition, memberPosition };
};
