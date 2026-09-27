import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenderType } from '@prisma/client';

export class CreatePersonDto {
  @ApiProperty({ example: 'Daniel', description: 'Nama depan individu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'Saptianus', description: 'Nama belakang / marga' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Daniel', description: 'Nama panggilan' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nickname?: string;

  @ApiPropertyOptional({
    enum: GenderType,
    default: GenderType.unknown,
    description: 'Jenis kelamin',
  })
  @IsEnum(GenderType)
  @IsOptional()
  gender?: GenderType = GenderType.unknown;

  @ApiPropertyOptional({ example: '1995-08-17', description: 'Tanggal lahir format YYYY-MM-DD' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: null, description: 'Tanggal wafat format YYYY-MM-DD' })
  @IsDateString()
  @IsOptional()
  deathDate?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Status masih hidup' })
  @IsBoolean()
  @IsOptional()
  isLiving?: boolean = true;

  @ApiPropertyOptional({ example: 'https://example.com/photos/daniel.jpg', description: 'URL foto' })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 'Anggota keluarga Saptianus', description: 'Catatan tambahan' })
  @IsString()
  @IsOptional()
  notes?: string;
}
