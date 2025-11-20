import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ListUsersQueryDto {
  /**
   * Optional filter by role. Only MODERATOR or RESEARCHER allowed.
   */
  @IsOptional()
  @IsEnum(UserRole, { 
    message: 'role must be MODERATOR or RESEARCHER' 
  })
  role?: UserRole;

  /**
   * Optional search query to filter users by email (case-insensitive)
   */
  @IsOptional()
  @IsString()
  search?: string;
}
