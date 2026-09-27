import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TreeEntity {
  @ApiProperty({ example: '7c1e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Keluarga Besar Wiryo' })
  name: string;

  @ApiPropertyOptional({ example: 'Catatan silsilah keturunan kakek Wiryo' })
  description?: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  rootPersonId?: string | null;

  @ApiProperty({ example: true })
  allowConcurrentPartnerships: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  rootPerson?: any;

  @ApiPropertyOptional()
  _count?: {
    persons: number;
    partnerships: number;
  };
}
