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
import { PersonsService } from '../../persons.service';
import { CreatePersonDto } from '../../core/dto/create-person.dto';
import { UpdatePersonDto } from '../../core/dto/update-person.dto';
import { PersonQueryDto } from '../../core/dto/person-query.dto';
import { PersonEntity } from '../../core/entities/person.entity';
import { Public } from '@common/decorators/public.decorator';
import { ApiSuccessResponse } from '@common/decorators/api-response.decorator';
import { PaginatedResponseDto } from '@common/dto/pagination.dto';

@ApiTags('Persons')
@Controller({ path: 'trees/:treeId/persons', version: '1' })
@Public()
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Menambah person ke pohon silsilah (FR-04)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiSuccessResponse(PersonEntity)
  async create(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Body() createPersonDto: CreatePersonDto,
  ) {
    return this.personsService.create(treeId, createPersonDto);
  }

  @Get()
  @ApiOperation({ summary: 'Mencari atau melihat daftar person dalam tree (FR-07)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiSuccessResponse(PaginatedResponseDto<PersonEntity>)
  async findAll(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Query() query: PersonQueryDto,
  ) {
    return this.personsService.findAll(treeId, query);
  }

  @Get(':personId')
  @ApiOperation({ summary: 'Melihat detail person beserta relasi langsung orang tua, anak, dan pasangan (FR-05)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'personId', type: 'string', format: 'uuid' })
  @ApiSuccessResponse(PersonEntity)
  async findOne(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Param('personId', new ParseUUIDPipe({ version: '4' })) personId: string,
  ) {
    return this.personsService.findOne(treeId, personId);
  }

  @Patch(':personId')
  @ApiOperation({ summary: 'Mengubah data person (FR-06)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'personId', type: 'string', format: 'uuid' })
  @ApiSuccessResponse(PersonEntity)
  async update(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Param('personId', new ParseUUIDPipe({ version: '4' })) personId: string,
    @Body() updatePersonDto: UpdatePersonDto,
  ) {
    return this.personsService.update(treeId, personId, updatePersonDto);
  }

  @Delete(':personId')
  @ApiOperation({ summary: 'Menghapus person beserta seluruh relasinya (FR-06)' })
  @ApiParam({ name: 'treeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'personId', type: 'string', format: 'uuid' })
  async remove(
    @Param('treeId', new ParseUUIDPipe({ version: '4' })) treeId: string,
    @Param('personId', new ParseUUIDPipe({ version: '4' })) personId: string,
  ) {
    return this.personsService.remove(treeId, personId);
  }
}
