import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreatePersonDto } from './core/dto/create-person.dto';
import { UpdatePersonDto } from './core/dto/update-person.dto';
import { PersonQueryDto } from './core/dto/person-query.dto';
import { PaginatedResponseDto } from '@common/dto/pagination.dto';
import { BusinessException, BusinessErrorCode } from '@common/exceptions/business.exception';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTreeExists(treeId: string) {
    const tree = await this.prisma.familyTree.findUnique({ where: { id: treeId } });
    if (!tree) {
      throw new BusinessException(
        BusinessErrorCode.TREE_NOT_FOUND,
        `Tree dengan ID ${treeId} tidak ditemukan`,
        { treeId },
        HttpStatus.NOT_FOUND,
      );
    }
    return tree;
  }

  private validateDates(birthDateStr?: string, deathDateStr?: string): { birthDate?: Date; deathDate?: Date; isLiving?: boolean } {
    let birthDate: Date | undefined = undefined;
    let deathDate: Date | undefined = undefined;

    if (birthDateStr) {
      birthDate = new Date(birthDateStr);
    }

    if (deathDateStr) {
      deathDate = new Date(deathDateStr);
    }

    // BR-07: death_date tidak boleh sebelum birth_date
    if (birthDate && deathDate && deathDate < birthDate) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_DATES,
        'Tanggal wafat (deathDate) tidak boleh mendahului tanggal lahir (birthDate)',
        { birthDate: birthDateStr, deathDate: deathDateStr },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      birthDate,
      deathDate,
      isLiving: deathDate ? false : undefined,
    };
  }

  async create(treeId: string, dto: CreatePersonDto) {
    await this.ensureTreeExists(treeId);

    const { birthDate, deathDate, isLiving } = this.validateDates(dto.birthDate, dto.deathDate);

    const finalIsLiving = deathDate ? false : dto.isLiving ?? true;

    return this.prisma.person.create({
      data: {
        tree_id: treeId,
        first_name: dto.firstName,
        last_name: dto.lastName,
        nickname: dto.nickname,
        gender: dto.gender ?? 'unknown',
        birth_date: birthDate,
        death_date: deathDate,
        is_living: finalIsLiving,
        photo_url: dto.photoUrl,
        notes: dto.notes,
      },
    });
  }

  async findAll(treeId: string, query: PersonQueryDto): Promise<PaginatedResponseDto<any>> {
    await this.ensureTreeExists(treeId);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { tree_id: treeId };

    if (query.q) {
      where.OR = [
        { first_name: { contains: query.q, mode: 'insensitive' } },
        { last_name: { contains: query.q, mode: 'insensitive' } },
        { nickname: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.gender) {
      where.gender = query.gender;
    }

    if (query.isLiving !== undefined) {
      where.is_living = query.isLiving;
    }

    const [total, data] = await Promise.all([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ created_at: 'desc' }],
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

  async findOne(treeId: string, personId: string) {
    await this.ensureTreeExists(treeId);

    const person = await this.prisma.person.findFirst({
      where: { id: personId, tree_id: treeId },
    });

    if (!person) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        `Person dengan ID ${personId} tidak ditemukan dalam tree ini`,
        { personId, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    // FR-05: Detail person beserta orang tua, anak, dan semua union-nya
    const [parentsRaw, childrenRaw, partnershipsRaw] = await Promise.all([
      this.prisma.parentChild.findMany({
        where: { tree_id: treeId, child_id: personId },
        include: {
          parent: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              gender: true,
              photo_url: true,
              birth_date: true,
              death_date: true,
              is_living: true,
            },
          },
        },
      }),
      this.prisma.parentChild.findMany({
        where: { tree_id: treeId, parent_id: personId },
        include: {
          child: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              gender: true,
              photo_url: true,
              birth_date: true,
              death_date: true,
              is_living: true,
            },
          },
        },
      }),
      this.prisma.partnership.findMany({
        where: {
          tree_id: treeId,
          OR: [{ person_a_id: personId }, { person_b_id: personId }],
        },
        include: {
          person_a: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              gender: true,
              photo_url: true,
              is_living: true,
            },
          },
          person_b: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              gender: true,
              photo_url: true,
              is_living: true,
            },
          },
        },
        orderBy: { start_date: 'asc' },
      }),
    ]);

    const parents = parentsRaw.map((p) => ({
      relationId: p.id,
      relationType: p.relation_type,
      partnershipId: p.partnership_id,
      startDate: p.start_date,
      endDate: p.end_date,
      parent: p.parent,
    }));

    const children = childrenRaw.map((c) => ({
      relationId: c.id,
      relationType: c.relation_type,
      partnershipId: c.partnership_id,
      startDate: c.start_date,
      endDate: c.end_date,
      child: c.child,
    }));

    const unions = partnershipsRaw.map((u, index) => {
      const isPersonA = u.person_a_id === personId;
      const partner = isPersonA ? u.person_b : u.person_a;
      const isCurrent =
        ['married', 'partner', 'separated'].includes(u.status) &&
        !u.end_date &&
        person.is_living &&
        partner.is_living;

      return {
        partnershipId: u.id,
        status: u.status,
        startDate: u.start_date,
        endDate: u.end_date,
        order: index + 1,
        isCurrent,
        notes: u.notes,
        partner,
      };
    });

    return {
      ...person,
      parents,
      children,
      unions,
    };
  }

  async update(treeId: string, personId: string, dto: UpdatePersonDto) {
    await this.ensureTreeExists(treeId);

    const existing = await this.prisma.person.findFirst({
      where: { id: personId, tree_id: treeId },
    });

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        `Person dengan ID ${personId} tidak ditemukan`,
        { personId, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    const birthDateStr = dto.birthDate !== undefined ? dto.birthDate : existing.birth_date?.toISOString().split('T')[0];
    const deathDateStr = dto.deathDate !== undefined ? dto.deathDate : existing.death_date?.toISOString().split('T')[0];

    const { birthDate, deathDate } = this.validateDates(birthDateStr, deathDateStr);

    let isLiving = dto.isLiving;
    if (deathDate) {
      isLiving = false;
    } else if (dto.deathDate === null) {
      // Menghapus tanggal wafat
      if (dto.isLiving === undefined) isLiving = true;
    }

    const updated = await this.prisma.person.update({
      where: { id: personId },
      data: {
        ...(dto.firstName !== undefined && { first_name: dto.firstName }),
        ...(dto.lastName !== undefined && { last_name: dto.lastName }),
        ...(dto.nickname !== undefined && { nickname: dto.nickname }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.birthDate !== undefined && { birth_date: birthDate }),
        ...(dto.deathDate !== undefined && { death_date: deathDate }),
        ...(isLiving !== undefined && { is_living: isLiving }),
        ...(dto.photoUrl !== undefined && { photo_url: dto.photoUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    // BR-16: Warning jika pasangan meninggal tapi status union masih aktif
    let warning: string | undefined = undefined;
    if (deathDate && !existing.death_date) {
      const activeUnions = await this.prisma.partnership.findMany({
        where: {
          tree_id: treeId,
          OR: [{ person_a_id: personId }, { person_b_id: personId }],
          status: { in: ['married', 'partner', 'separated'] },
          end_date: null,
        },
      });

      if (activeUnions.length > 0) {
        warning = 'UNION_STILL_ACTIVE: Person ini memiliki union aktif. Disarankan mengubah status union menjadi widowed dengan end_date = death_date';
      }
    }

    return {
      ...updated,
      ...(warning && { warning }),
    };
  }

  async remove(treeId: string, personId: string) {
    await this.ensureTreeExists(treeId);

    const existing = await this.prisma.person.findFirst({
      where: { id: personId, tree_id: treeId },
    });

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        `Person dengan ID ${personId} tidak ditemukan`,
        { personId, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    // Cascade terhapus otomatis di PostgreSQL via foreign key
    await this.prisma.person.delete({ where: { id: personId } });

    return {
      id: personId,
      deleted: true,
      message: `Person ${existing.first_name} ${existing.last_name || ''} dan seluruh relasinya berhasil dihapus`,
    };
  }
}
