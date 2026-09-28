import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ScopedViewQueryDto {
  @ApiPropertyOptional({
    description: 'ID Person yang menjadi titik pandang (opsional, default ke person_id user yang sedang login atau root_person_id tree)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'personId harus berupa UUID v4 yang valid' })
  personId?: string;
}
