import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParentRelationType } from '@prisma/client';

export class CreateParentChildDto {
  @ApiProperty({ example: 'a1b28400-e29b-41d4-a716-446655440000', description: 'ID person yang menjadi orang tua' })
  @IsUUID('4')
  @IsNotEmpty()
  parentId: string;

  @ApiProperty({ example: 'c3d48400-e29b-41d4-a716-446655440000', description: 'ID person yang menjadi anak' })
  @IsUUID('4')
  @IsNotEmpty()
  childId: string;

  @ApiPropertyOptional({
    enum: ParentRelationType,
    default: ParentRelationType.biological,
    description: 'Tipe relasi orang tua ke anak',
  })
  @IsEnum(ParentRelationType)
  @IsOptional()
  relationType?: ParentRelationType = ParentRelationType.biological;

  @ApiPropertyOptional({
    example: 'u0018400-e29b-41d4-a716-446655440000',
    description: 'ID union/pernikahan asal lahirnya anak',
  })
  @IsUUID('4')
  @IsOptional()
  partnershipId?: string;

  @ApiPropertyOptional({ example: '2015-06-01', description: 'Tanggal mulai (adopsi/asuh)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-06-01', description: 'Tanggal selesai (asuh/wali)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
