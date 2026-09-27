import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenderType } from '@prisma/client';

export class PersonEntity {
  @ApiProperty({ example: 'a1b28400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '7c1e8400-e29b-41d4-a716-446655440000' })
  treeId: string;

  @ApiProperty({ example: 'Soedarmo' })
  firstName: string;

  @ApiPropertyOptional({ example: 'Wiryo' })
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'Mbah Darmo' })
  nickname?: string | null;

  @ApiProperty({ enum: GenderType, example: GenderType.male })
  gender: GenderType;

  @ApiPropertyOptional({ example: '1940-03-12' })
  birthDate?: Date | null;

  @ApiPropertyOptional({ example: '2010-07-01' })
  deathDate?: Date | null;

  @ApiProperty({ example: false })
  isLiving: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/photos/darmo.jpg' })
  photoUrl?: string | null;

  @ApiPropertyOptional({ example: 'Catatan tambahan' })
  notes?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
