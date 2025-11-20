import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  /**
   * The new role to assign to the user.
   * Valid transitions are enforced in the service layer.
   */
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole' })
  role!: UserRole;
}