import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenderType } from '@prisma/client';

export class PersonEntity {
  @ApiProperty({ example: 'a1b28400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '7c1e8400-e29b-41d4-a716-446655440000' })
  treeId: string;

  @ApiProperty({ example: 'Daniel' })
  firstName: string;

  @ApiPropertyOptional({ example: 'Saptianus' })
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'Daniel' })
  nickname?: string | null;

  @ApiProperty({ enum: GenderType, example: GenderType.male })
  gender: GenderType;

  @ApiPropertyOptional({ example: '1995-08-17' })
  birthDate?: Date | null;

  @ApiPropertyOptional({ example: null })
  deathDate?: Date | null;

  @ApiProperty({ example: true })
  isLiving: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/photos/daniel.jpg' })
  photoUrl?: string | null;

  @ApiPropertyOptional({ example: 'Anggota keluarga Saptianus' })
  notes?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
