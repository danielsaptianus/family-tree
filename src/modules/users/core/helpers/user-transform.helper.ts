import { User, Position, PositionPermission, Permission } from '@prisma/client';
import { UserResponseDto } from '../dto/user-response.dto';

type UserWithRelations = User & {
  position?: Position & {
    position_permissions?: (PositionPermission & {
      permission: Permission;
    })[];
  };
};

export class UserTransformHelper {
  static toDto(user: UserWithRelations): UserResponseDto {
    const permissions = user.position?.position_permissions?.map(
      (pp) => pp.permission.name,
    ) || [];

    return new UserResponseDto({
      ...user,
      permissions,
      position: user.position ? {
        id: user.position.id,
        name: user.position.name,
        description: user.position.description,
      } : undefined,
    });
  }

  static toDtos(users: UserWithRelations[]): UserResponseDto[] {
    return users.map((user) => this.toDto(user));
  }
}
