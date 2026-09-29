import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsInt, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'daniel@gmail.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({ example: 'Daniel' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  first_name: string;

  @ApiProperty({ example: 'Saptianus' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  last_name: string;

  @ApiProperty({ example: 2, description: 'Position ID' })
  @IsInt({ message: 'Position ID must be an integer' })
  @IsNotEmpty({ message: 'Position ID is required' })
  position_id: number;

  @ApiProperty({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;

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
