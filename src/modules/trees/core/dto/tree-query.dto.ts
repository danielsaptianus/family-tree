import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';

export class TreeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Pencarian nama pohon' })
  @IsString()
  @IsOptional()
  search?: string;
}
