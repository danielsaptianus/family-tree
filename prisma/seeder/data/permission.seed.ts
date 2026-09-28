import { PrismaClient } from '@prisma/client';

export const seedPermissions = async (
  prisma: PrismaClient,
  adminPositionId: number,
  memberPositionId: number,
) => {
  console.log('🔐 Seeding permissions...');

  const permissionsData = [
    // User Management
    { name: 'VIEW_USER', resource: 'USER', action: 'VIEW', description: 'View user information' },
    { name: 'ADD_USER', resource: 'USER', action: 'ADD', description: 'Create new user' },
    { name: 'UPDATE_USER', resource: 'USER', action: 'UPDATE', description: 'Update user information' },
    { name: 'DELETE_USER', resource: 'USER', action: 'DELETE', description: 'Delete user' },
    { name: 'MANAGE_USER_PERMISSION', resource: 'USER', action: 'MANAGE_PERMISSION', description: 'Assign or revoke user permissions' },
    { name: 'CHANGE_USER_POSITION', resource: 'USER', action: 'CHANGE_POSITION', description: 'Change user position/role' },

    // Position Management
    { name: 'VIEW_POSITION', resource: 'POSITION', action: 'VIEW', description: 'View position information' },
    { name: 'ADD_POSITION', resource: 'POSITION', action: 'ADD', description: 'Create new position' },
    { name: 'UPDATE_POSITION', resource: 'POSITION', action: 'UPDATE', description: 'Update position information' },
    { name: 'DELETE_POSITION', resource: 'POSITION', action: 'DELETE', description: 'Delete position' },

    // Permission Management
    { name: 'VIEW_PERMISSION', resource: 'PERMISSION', action: 'VIEW', description: 'View permission information' },
    { name: 'ADD_PERMISSION', resource: 'PERMISSION', action: 'ADD', description: 'Create new permission' },
    { name: 'UPDATE_PERMISSION', resource: 'PERMISSION', action: 'UPDATE', description: 'Update permission information' },
    { name: 'DELETE_PERMISSION', resource: 'PERMISSION', action: 'DELETE', description: 'Delete permission' },
    // Tree Management
    { name: 'VIEW_TREE', resource: 'TREE', action: 'VIEW', description: 'View family tree' },
    { name: 'ADD_TREE', resource: 'TREE', action: 'ADD', description: 'Create family tree' },
    { name: 'UPDATE_TREE', resource: 'TREE', action: 'UPDATE', description: 'Update family tree' },
    { name: 'DELETE_TREE', resource: 'TREE', action: 'DELETE', description: 'Delete family tree' },

    // Person Management
    { name: 'VIEW_PERSON', resource: 'PERSON', action: 'VIEW', description: 'View person profile' },
    { name: 'ADD_PERSON', resource: 'PERSON', action: 'ADD', description: 'Create person profile' },
    { name: 'UPDATE_PERSON', resource: 'PERSON', action: 'UPDATE', description: 'Update person profile' },
    { name: 'DELETE_PERSON', resource: 'PERSON', action: 'DELETE', description: 'Delete person profile' },

    // Relationship Management
    { name: 'VIEW_RELATIONSHIP', resource: 'RELATIONSHIP', action: 'VIEW', description: 'View relationship' },
    { name: 'ADD_RELATIONSHIP', resource: 'RELATIONSHIP', action: 'ADD', description: 'Create relationship' },
    { name: 'UPDATE_RELATIONSHIP', resource: 'RELATIONSHIP', action: 'UPDATE', description: 'Update relationship' },
    { name: 'DELETE_RELATIONSHIP', resource: 'RELATIONSHIP', action: 'DELETE', description: 'Delete relationship' },
  ];

  const permissions = await Promise.all(
    permissionsData.map((permission) =>
      prisma.permission.create({ data: permission }),
    ),
  );

  console.log(`✅ ${permissions.length} permissions seeded`);

  // ============================================
  // Assign Permissions to Positions
  // ============================================
  console.log('🔗 Assigning permissions to positions...');

  // Admin gets all permissions (including ADD_USER, UPDATE_USER, DELETE_USER, etc.)
  const adminPermissions = permissions.map((permission) => ({
    position_id: adminPositionId,
    permission_id: permission.id,
  }));

  await prisma.positionPermission.createMany({
    data: adminPermissions,
  });

  // Member (USER) gets view permissions
  const userAllowedPermissions = ['VIEW_USER', 'VIEW_TREE', 'VIEW_PERSON', 'VIEW_RELATIONSHIP'];
  const memberPermissions = permissions
    .filter((p) => userAllowedPermissions.includes(p.name))
    .map((p) => ({
      position_id: memberPositionId,
      permission_id: p.id,
    }));

  if (memberPermissions.length > 0) {
    await prisma.positionPermission.createMany({
      data: memberPermissions,
    });
  }

  console.log('✅ Permissions assigned to positions');
};
