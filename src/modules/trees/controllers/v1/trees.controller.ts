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
import { ScopedViewQueryDto } from '../../core/dto/scoped-view-query.dto';
import { RenderTreeQueryDto } from '../../core/dto/render-tree-query.dto';
import { GetUser } from '@common/decorators/get-user.decorator';
import { JwtPayload } from '@modules/auth/core/interfaces/jwt-payload.interface';
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

  @Get(':treeId/my-view')
  @ApiOperation({
    summary: 'Tampilan silsilah keluarga terfokus user (2 generasi ke atas & seluruh keturunan)',
    description:
      'Menampilkan silsilah 2 generasi ke atas (kakek/nenek & orang tua), saudara selevel, paman/bibi (beserta jumlah sepupu tanpa menampilkan node sepupu langsung), serta seluruh keturunan ke bawah.',
  })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  async getMyView(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Query() query: ScopedViewQueryDto,
    @GetUser() user?: JwtPayload,
  ) {
    return this.treesService.getMyView(treeId, query.personId, user?.personId || undefined);
  }

  @Get(':treeId/persons/:personId/cousins')
  @ApiOperation({
    summary: 'Melihat daftar sepupu (anak dari paman/bibi) saat diklik',
    description: 'Mengambil data sepupu secara on-demand ketika pengguna mengklik salah satu paman atau bibi.',
  })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'personId', type: 'string', format: 'uuid', description: 'ID person paman atau bibi' })
  async getCousins(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Param('personId', new ParseUUIDPipe({ version: '4' })) personId: string,
  ) {
    return this.treesService.getCousins(treeId, personId);
  }

  @Get(':treeId/render')
  @ApiOperation({
    summary: 'Fitur melihat keseluruhan silsilah pohon keluarga (FR-13 - FR-16)',
    description:
      'Menghasilkan struktur silsilah lengkap untuk D3.js dalam format hierarchy atau graph dengan kontrol depth dan direction.',
  })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  async renderTree(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Query() query: RenderTreeQueryDto,
  ) {
    return this.treesService.renderTree(treeId, query);
  }
}
