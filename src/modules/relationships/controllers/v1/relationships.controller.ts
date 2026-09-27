import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { RelationshipsService } from '../../relationships.service';
import { CreateParentChildDto } from '../../core/dto/create-parent-child.dto';
import { CreatePartnershipDto } from '../../core/dto/create-partnership.dto';
import { UpdatePartnershipDto } from '../../core/dto/update-partnership.dto';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Relationships')
@Controller({ path: 'trees/:treeId', version: '1' })
@Public()
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  // ============================================
  // PARENT-CHILD ENDPOINTS
  // ============================================

  @Post('parent-child')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Menambah relasi orang tua–anak (FR-08)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  async createParentChild(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Body() dto: CreateParentChildDto,
  ) {
    return this.relationshipsService.createParentChild(treeId, dto);
  }

  @Delete('parent-child/:id')
  @ApiOperation({ summary: 'Menghapus relasi orang tua–anak (FR-09)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'ID relasi parent_child' })
  async removeParentChild(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.relationshipsService.removeParentChild(treeId, id);
  }

  // ============================================
  // PARTNERSHIPS ENDPOINTS
  // ============================================

  @Post('partnerships')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Menambah relasi pasangan/union (FR-10)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  async createPartnership(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Body() dto: CreatePartnershipDto,
  ) {
    return this.relationshipsService.createPartnership(treeId, dto);
  }

  @Patch('partnerships/:id')
  @ApiOperation({ summary: 'Mengubah status atau periode relasi pasangan (FR-11)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'ID partnership' })
  async updatePartnership(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePartnershipDto,
  ) {
    return this.relationshipsService.updatePartnership(treeId, id, dto);
  }

  @Delete('partnerships/:id')
  @ApiOperation({ summary: 'Menghapus relasi pasangan/union (FR-11)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'ID partnership' })
  async removePartnership(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.relationshipsService.removePartnership(treeId, id);
  }
}
