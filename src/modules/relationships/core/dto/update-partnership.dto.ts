import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartnershipStatus } from '@prisma/client';

export class UpdatePartnershipDto {
  @ApiPropertyOptional({
    enum: PartnershipStatus,
    description: 'Status hubungan pasangan',
  })
  @IsEnum(PartnershipStatus)
  @IsOptional()
  status?: PartnershipStatus;

  @ApiPropertyOptional({ example: '1977-01-15', description: 'Tanggal mulai pernikahan/hubungan' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2010-07-01', description: 'Tanggal berakhir (cerai/wafat)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Catatan tambahan', description: 'Catatan tambahan' })
  @IsString()
  @IsOptional()
  notes?: string;
}
