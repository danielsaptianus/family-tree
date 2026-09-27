import { Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateTreeDto } from './core/dto/create-tree.dto';
import { UpdateTreeDto } from './core/dto/update-tree.dto';
import { TreeQueryDto } from './core/dto/tree-query.dto';
import { PaginatedResponseDto } from '@common/dto/pagination.dto';
import { BusinessException, BusinessErrorCode } from '@common/exceptions/business.exception';

@Injectable()
export class TreesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTreeDto) {
    if (dto.rootPersonId) {
      const person = await this.prisma.person.findUnique({
        where: { id: dto.rootPersonId },
      });
      if (!person) {
        throw new BusinessException(
          BusinessErrorCode.PERSON_NOT_FOUND,
          `Root person dengan ID ${dto.rootPersonId} tidak ditemukan`,
          { rootPersonId: dto.rootPersonId },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    return this.prisma.familyTree.create({
      data: {
        name: dto.name,
        description: dto.description,
        root_person_id: dto.rootPersonId,
        allow_concurrent_partnerships: dto.allowConcurrentPartnerships ?? true,
      },
      include: {
        root_person: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            gender: true,
            photo_url: true,
          },
        },
      },
    });
  }

  async findAll(query: TreeQueryDto): Promise<PaginatedResponseDto<any>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.familyTree.count({ where }),
      this.prisma.familyTree.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          root_person: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              gender: true,
              photo_url: true,
            },
          },
          _count: {
            select: {
              persons: true,
              partnerships: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const tree = await this.prisma.familyTree.findUnique({
      where: { id },
      include: {
        root_person: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            gender: true,
            birth_date: true,
            death_date: true,
            is_living: true,
            photo_url: true,
          },
        },
        _count: {
          select: {
            persons: true,
            partnerships: true,
            parent_child: true,
          },
        },
      },
    });

    if (!tree) {
      throw new BusinessException(
        BusinessErrorCode.TREE_NOT_FOUND,
        `Tree dengan ID ${id} tidak ditemukan`,
        { treeId: id },
        HttpStatus.NOT_FOUND,
      );
    }

    return tree;
  }

  async update(id: string, dto: UpdateTreeDto) {
    const existing = await this.prisma.familyTree.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.TREE_NOT_FOUND,
        `Tree dengan ID ${id} tidak ditemukan`,
        { treeId: id },
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.rootPersonId) {
      const person = await this.prisma.person.findUnique({
        where: { id: dto.rootPersonId },
      });
      if (!person) {
        throw new BusinessException(
          BusinessErrorCode.PERSON_NOT_FOUND,
          `Root person dengan ID ${dto.rootPersonId} tidak ditemukan`,
          { rootPersonId: dto.rootPersonId },
          HttpStatus.NOT_FOUND,
        );
      }

      // BR-10: root_person_id tree harus person di tree tersebut
      if (person.tree_id !== id) {
        throw new BusinessException(
          BusinessErrorCode.CROSS_TREE_RELATION,
          `Root person harus merupakan anggota dari tree ini`,
          { rootPersonId: dto.rootPersonId, treeId: id, personTreeId: person.tree_id },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    return this.prisma.familyTree.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.rootPersonId !== undefined && { root_person_id: dto.rootPersonId }),
        ...(dto.allowConcurrentPartnerships !== undefined && {
          allow_concurrent_partnerships: dto.allowConcurrentPartnerships,
        }),
      },
      include: {
        root_person: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            gender: true,
            photo_url: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.familyTree.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.TREE_NOT_FOUND,
        `Tree dengan ID ${id} tidak ditemukan`,
        { treeId: id },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.familyTree.delete({ where: { id } });
    return { id, deleted: true, message: `Tree ${existing.name} dan seluruh datanya berhasil dihapus` };
  }
}
