import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { TreesService } from '../../trees.service';
import { CreateTreeDto } from '../../core/dto/create-tree.dto';
import { UpdateTreeDto } from '../../core/dto/update-tree.dto';
import { TreeQueryDto } from '../../core/dto/tree-query.dto';
import { TreeEntity } from '../../core/entities/tree.entity';
import { Public } from '@common/decorators/public.decorator';
import { ApiSuccessResponse } from '@common/decorators/api-response.decorator';
import { PaginatedResponseDto } from '@common/dto/pagination.dto';

@ApiTags('Trees')
@Controller({ path: 'trees', version: '1' })
@Public()
export class TreesController {
  constructor(private readonly treesService: TreesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Membuat pohon silsilah keluarga baru (FR-01)' })
  @ApiSuccessResponse(TreeEntity)
  async create(@Body() createTreeDto: CreateTreeDto) {
    return this.treesService.create(createTreeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Melihat daftar pohon keluarga dengan pagination (FR-02)' })
  @ApiSuccessResponse(PaginatedResponseDto<TreeEntity>)
  async findAll(@Query() query: TreeQueryDto) {
    return this.treesService.findAll(query);
  }

  @Get(':treeId')
  @ApiOperation({ summary: 'Melihat detail pohon keluarga beserta statistik (FR-02)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiSuccessResponse(TreeEntity)
  async findOne(@Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string) {
    return this.treesService.findOne(treeId);
  }

  @Patch(':treeId')
  @ApiOperation({ summary: 'Mengubah data pohon keluarga (FR-03)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiSuccessResponse(TreeEntity)
  async update(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Body() updateTreeDto: UpdateTreeDto,
  ) {
    return this.treesService.update(treeId, updateTreeDto);
  }

  @Delete(':treeId')
  @ApiOperation({ summary: 'Menghapus pohon keluarga dan seluruh datanya (FR-03)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  async remove(@Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string) {
    return this.treesService.remove(treeId);
  }
}
