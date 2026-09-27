import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTreeDto {
  @ApiProperty({ example: 'Keluarga Besar Wiryo', description: 'Nama pohon silsilah keluarga' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Catatan silsilah keturunan kakek Wiryo', description: 'Deskripsi silsilah' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID person yang menjadi root silsilah' })
  @IsUUID('4')
  @IsOptional()
  rootPersonId?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Mengizinkan lebih dari satu pasangan aktif (poligami)' })
  @IsBoolean()
  @IsOptional()
  allowConcurrentPartnerships?: boolean = true;
}
