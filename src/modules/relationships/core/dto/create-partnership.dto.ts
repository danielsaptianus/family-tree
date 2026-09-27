import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartnershipStatus } from '@prisma/client';

export class CreatePartnershipDto {
  @ApiProperty({ example: 'a1b28400-e29b-41d4-a716-446655440000', description: 'ID person pertama' })
  @IsUUID('4')
  @IsNotEmpty()
  personAId: string;

  @ApiProperty({ example: 'e5f68400-e29b-41d4-a716-446655440000', description: 'ID person kedua' })
  @IsUUID('4')
  @IsNotEmpty()
  personBId: string;

  @ApiPropertyOptional({
    enum: PartnershipStatus,
    default: PartnershipStatus.married,
    description: 'Status hubungan pasangan',
  })
  @IsEnum(PartnershipStatus)
  @IsOptional()
  status?: PartnershipStatus = PartnershipStatus.married;

  @ApiPropertyOptional({ example: '1977-01-15', description: 'Tanggal mulai pernikahan/hubungan' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2010-07-01', description: 'Tanggal berakhir (cerai/wafat)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Pernikahan tercatat di KUA', description: 'Catatan tambahan' })
  @IsString()
  @IsOptional()
  notes?: string;
}
