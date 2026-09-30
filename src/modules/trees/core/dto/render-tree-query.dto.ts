import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum RenderDirection {
  DESCENDANTS = 'descendants',
  ANCESTORS = 'ancestors',
  ALL = 'all',
}

export enum RenderFormat {
  HIERARCHY = 'hierarchy',
  GRAPH = 'graph',
}

export class RenderTreeQueryDto {
  @ApiPropertyOptional({
    description: 'Titik awal silsilah (default ke root_person_id tree)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'rootId harus berupa UUID v4 yang valid' })
  rootId?: string;

  @ApiPropertyOptional({
    description: 'Arah penelusuran silsilah',
    enum: RenderDirection,
    default: RenderDirection.DESCENDANTS,
  })
  @IsOptional()
  @IsEnum(RenderDirection, { message: 'direction harus descendants, ancestors, atau all' })
  direction?: RenderDirection = RenderDirection.DESCENDANTS;

  @ApiPropertyOptional({
    description: 'Batas kedalaman generasi penelusuran (1-20)',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'depth harus berupa angka bulat' })
  @Min(1, { message: 'depth minimal 1' })
  @Max(20, { message: 'depth maksimal 20' })
  depth?: number = 5;

  @ApiPropertyOptional({
    description: 'Format output visualisasi D3.js (hierarchy untuk tree bertingkat, graph untuk jaringan nodes & links)',
    enum: RenderFormat,
    default: RenderFormat.HIERARCHY,
  })
  @IsOptional()
  @IsEnum(RenderFormat, { message: 'format harus hierarchy atau graph' })
  format?: RenderFormat = RenderFormat.HIERARCHY;

  @ApiPropertyOptional({
    description: 'Sertakan data pasangan/union di setiap node',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includePartners?: boolean = true;

  @ApiPropertyOptional({
    description: 'Sertakan anak tiri dari pasangan',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeStepChildren?: boolean = false;

  @ApiPropertyOptional({
    description: 'Tipe relasi parent-child (CSV: biological, adopted, foster, guardian)',
    example: 'biological,adopted',
    default: 'biological,adopted',
  })
  @IsOptional()
  relationTypes?: string = 'biological,adopted';

  @ApiPropertyOptional({
    description: 'Status perkawinan yang disertakan (CSV: married, divorced, widowed, separated, annulled, partner)',
    example: 'married,partner,widowed',
  })
  @IsOptional()
  unionStatuses?: string;
}
