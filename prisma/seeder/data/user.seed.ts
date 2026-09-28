import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const seedUsers = async (
  prisma: PrismaClient,
  adminPositionId: number,
  memberPositionId: number,
) => {
  console.log('👥 Seeding users...');

  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@gmail.com',
      password: hashedPassword,
      first_name: 'Daniel',
      last_name: 'Saptianus (Admin)',
      position_id: adminPositionId,
      is_active: true,
    },
  });

  const memberUser = await prisma.user.create({
    data: {
      email: 'daniel@gmail.com',
      password: hashedPassword,
      first_name: 'Daniel',
      last_name: 'Saptianus',
      position_id: memberPositionId,
      is_active: true,
    },
  });

  console.log('✅ Users seeded');

  return { adminUser, memberUser, defaultPassword };
};
