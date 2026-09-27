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
  @ApiProperty({ example: 'Soedarmo', description: 'Nama depan individu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'Wiryo', description: 'Nama belakang / marga' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Mbah Darmo', description: 'Nama panggilan' })
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

  @ApiPropertyOptional({ example: '1940-03-12', description: 'Tanggal lahir format YYYY-MM-DD' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: '2010-07-01', description: 'Tanggal wafat format YYYY-MM-DD' })
  @IsDateString()
  @IsOptional()
  deathDate?: string;

  @ApiPropertyOptional({ example: false, default: true, description: 'Status masih hidup' })
  @IsBoolean()
  @IsOptional()
  isLiving?: boolean = true;

  @ApiPropertyOptional({ example: 'https://example.com/photos/darmo.jpg', description: 'URL foto' })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 'Pensiunan pegawai negeri', description: 'Catatan tambahan' })
  @IsString()
  @IsOptional()
  notes?: string;
}
