import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { GenderType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class PersonQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Pencarian nama depan, belakang, atau panggilan (q)' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: GenderType, description: 'Filter jenis kelamin' })
  @IsEnum(GenderType)
  @IsOptional()
  gender?: GenderType;

  @ApiPropertyOptional({ description: 'Filter status hidup' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isLiving?: boolean;
}
