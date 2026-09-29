import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'daniel@gmail.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'newpassword123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'Daniel' })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Saptianus' })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ example: '7c1e8400-e29b-41d4-a716-446655440000', description: 'ID pohon silsilah keluarga user' })
  @IsUUID('4')
  @IsOptional()
  tree_id?: string;

  @ApiPropertyOptional({ example: 'a1b28400-e29b-41d4-a716-446655440000', description: 'ID person diri user di dalam silsilah' })
  @IsUUID('4')
  @IsOptional()
  person_id?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Jika true, backend otomatis membuat profil Person di tree dan menjadikannya root jika tree belum punya root',
  })
  @IsBoolean()
  @IsOptional()
  auto_create_person?: boolean;
}
