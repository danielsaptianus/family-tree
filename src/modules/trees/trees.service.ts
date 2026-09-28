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

  // =========================================================================
  // SCOPED USER VIEW (2 Generasi ke atas, saudara, paman/bibi & seluruh keturunan)
  // =========================================================================

  private formatPerson(p: any) {
    if (!p) return null;
    return {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      name: `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}`,
      gender: p.gender,
      birthDate: p.birth_date,
      deathDate: p.death_date,
      isLiving: p.is_living,
      photoUrl: p.photo_url,
      notes: p.notes,
    };
  }

  private async getPartnershipsForPersons(treeId: string, personIds: string[]) {
    const map = new Map<string, any[]>();
    if (personIds.length === 0) return map;

    const partnerships = await this.prisma.partnership.findMany({
      where: {
        tree_id: treeId,
        OR: [
          { person_a_id: { in: personIds } },
          { person_b_id: { in: personIds } },
        ],
      },
      include: {
        person_a: true,
        person_b: true,
      },
    });

    for (const p of partnerships) {
      if (personIds.includes(p.person_a_id)) {
        const partnerOfA = this.formatPerson(p.person_b);
        const union = {
          partnershipId: p.id,
          status: p.status,
          startDate: p.start_date,
          endDate: p.end_date,
          partner: partnerOfA,
        };
        if (!map.has(p.person_a_id)) map.set(p.person_a_id, []);
        map.get(p.person_a_id)!.push(union);
      }

      if (personIds.includes(p.person_b_id)) {
        const partnerOfB = this.formatPerson(p.person_a);
        const union = {
          partnershipId: p.id,
          status: p.status,
          startDate: p.start_date,
          endDate: p.end_date,
          partner: partnerOfB,
        };
        if (!map.has(p.person_b_id)) map.set(p.person_b_id, []);
        map.get(p.person_b_id)!.push(union);
      }
    }

    return map;
  }

  async getMyView(treeId: string, targetPersonId?: string, authUserPersonId?: string) {
    const tree = await this.prisma.familyTree.findUnique({
      where: { id: treeId },
    });
    if (!tree) {
      throw new BusinessException(
        BusinessErrorCode.TREE_NOT_FOUND,
        `Tree dengan ID ${treeId} tidak ditemukan`,
        { treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    const effectivePersonId = targetPersonId || authUserPersonId || tree.root_person_id;
    if (!effectivePersonId) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        'Belum ada person yang ditentukan untuk melihat silsilah keluarga (target personId atau root_person_id tidak tersedia)',
        { treeId },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rootPerson = await this.prisma.person.findUnique({
      where: { id: effectivePersonId },
    });
    if (!rootPerson || rootPerson.tree_id !== treeId) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        `Person dengan ID ${effectivePersonId} tidak ditemukan di dalam pohon keluarga ini`,
        { personId: effectivePersonId, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    // 1. Partnerships of Root Person
    const partnershipMap = await this.getPartnershipsForPersons(treeId, [rootPerson.id]);
    const rootFormatted = {
      ...this.formatPerson(rootPerson),
      unions: partnershipMap.get(rootPerson.id) || [],
    };

    // 2. Parents of Root Person (Gen +1)
    const parentRelations = await this.prisma.parentChild.findMany({
      where: {
        tree_id: treeId,
        child_id: rootPerson.id,
      },
      include: {
        parent: true,
      },
    });
    const parentIds = parentRelations.map((pr) => pr.parent_id);
    const parentPartnershipMap = await this.getPartnershipsForPersons(treeId, parentIds);
    const parentsFormatted = parentRelations.map((pr) => ({
      ...this.formatPerson(pr.parent),
      relationType: pr.relation_type,
      unions: parentPartnershipMap.get(pr.parent_id) || [],
    }));

    // 3. Siblings of Root Person (Gen 0)
    let siblingsFormatted: any[] = [];
    if (parentIds.length > 0) {
      const siblingRelations = await this.prisma.parentChild.findMany({
        where: {
          tree_id: treeId,
          parent_id: { in: parentIds },
          child_id: { not: rootPerson.id },
        },
        include: {
          child: true,
        },
      });

      const siblingMap = new Map<string, any>();
      for (const sr of siblingRelations) {
        if (!siblingMap.has(sr.child_id)) {
          siblingMap.set(sr.child_id, {
            child: sr.child,
            parentIds: [sr.parent_id],
            relationTypes: [sr.relation_type],
          });
        } else {
          siblingMap.get(sr.child_id)!.parentIds.push(sr.parent_id);
          siblingMap.get(sr.child_id)!.relationTypes.push(sr.relation_type);
        }
      }

      const siblingIds = Array.from(siblingMap.keys());
      const siblingPartnershipMap = await this.getPartnershipsForPersons(treeId, siblingIds);

      siblingsFormatted = siblingIds.map((sId) => {
        const item = siblingMap.get(sId)!;
        const sharedParentCount = item.parentIds.filter((p: string) => parentIds.includes(p)).length;
        const siblingType = sharedParentCount >= 2 ? 'kandung' : 'tiri';

        return {
          ...this.formatPerson(item.child),
          siblingType,
          relationTypes: item.relationTypes,
          unions: siblingPartnershipMap.get(sId) || [],
        };
      });
    }

    // 4. Grandparents of Root Person (Gen +2)
    let grandparentsFormatted: any[] = [];
    let grandparentIds: string[] = [];
    if (parentIds.length > 0) {
      const grandparentRelations = await this.prisma.parentChild.findMany({
        where: {
          tree_id: treeId,
          child_id: { in: parentIds },
        },
        include: {
          parent: true,
        },
      });

      grandparentIds = Array.from(new Set(grandparentRelations.map((gr) => gr.parent_id)));
      const gpPartnershipMap = await this.getPartnershipsForPersons(treeId, grandparentIds);
      const uniqueGrandparentsMap = new Map<string, any>();

      for (const gr of grandparentRelations) {
        if (!uniqueGrandparentsMap.has(gr.parent_id)) {
          const parentOfChild = parentRelations.find((p) => p.parent_id === gr.child_id)?.parent;
          const lineage = parentOfChild?.gender === 'female' ? 'maternal' : 'paternal';
          uniqueGrandparentsMap.set(gr.parent_id, {
            ...this.formatPerson(gr.parent),
            lineage,
            unions: gpPartnershipMap.get(gr.parent_id) || [],
          });
        }
      }
      grandparentsFormatted = Array.from(uniqueGrandparentsMap.values());
    }

    // 5. Paman & Bibi (Aunts & Uncles - Gen +1 siblings of parents)
    let auntsAndUnclesFormatted: any[] = [];
    if (grandparentIds.length > 0) {
      const auntUncleRelations = await this.prisma.parentChild.findMany({
        where: {
          tree_id: treeId,
          parent_id: { in: grandparentIds },
          child_id: { notIn: parentIds },
        },
        include: {
          child: true,
        },
      });

      const uniqueAuntUncleMap = new Map<string, any>();
      for (const aur of auntUncleRelations) {
        if (!uniqueAuntUncleMap.has(aur.child_id)) {
          uniqueAuntUncleMap.set(aur.child_id, aur.child);
        }
      }

      const auntUncleIds = Array.from(uniqueAuntUncleMap.keys());
      const auPartnershipMap = await this.getPartnershipsForPersons(treeId, auntUncleIds);

      // Count cousins (children of each aunt/uncle)
      const cousinRelations = await this.prisma.parentChild.findMany({
        where: {
          tree_id: treeId,
          parent_id: { in: auntUncleIds },
        },
        select: {
          parent_id: true,
          child_id: true,
        },
      });

      const cousinCountMap = new Map<string, number>();
      for (const cr of cousinRelations) {
        cousinCountMap.set(cr.parent_id, (cousinCountMap.get(cr.parent_id) || 0) + 1);
      }

      auntsAndUnclesFormatted = auntUncleIds.map((auId) => {
        const p = uniqueAuntUncleMap.get(auId);
        const count = cousinCountMap.get(auId) || 0;
        return {
          ...this.formatPerson(p),
          role: p.gender === 'female' ? 'Bibi' : 'Paman',
          unions: auPartnershipMap.get(auId) || [],
          hasCousins: count > 0,
          cousinCount: count,
          cousinsUrl: `/api/v1/trees/${treeId}/persons/${auId}/cousins`,
          cousins: [], // Di-load saat klik paman/bibi sesuai permintaan
        };
      });
    }

    // 6. Descendants (Seluruh generasi ke bawah tanpa batas kedalaman)
    const descendants = await this.getDescendantsRecursive(treeId, rootPerson.id, 1);

    return {
      tree: {
        id: tree.id,
        name: tree.name,
        description: tree.description,
      },
      rootPerson: rootFormatted,
      generation0: {
        self: rootFormatted,
        siblings: siblingsFormatted, // sepupu tidak langsung tampil di sini
      },
      generation1Up: {
        parents: parentsFormatted,
        auntsAndUncles: auntsAndUnclesFormatted, // paman dan bibi (klik untuk lihat sepupu)
      },
      generation2Up: {
        grandparents: grandparentsFormatted, // kakek dan nenek (maksimal 2 generasi ke atas)
      },
      descendants, // seluruh generasi ke bawah
      meta: {
        treeId,
        rootPersonId: rootPerson.id,
        maxGenerationsUp: 2,
        scope: 'USER_FAMILY_VIEW',
        description:
          'Tampilan keluarga terfokus: 2 generasi ke atas, saudara selevel, paman/bibi (klik untuk muat sepupu), dan seluruh generasi ke bawah.',
      },
    };
  }

  private async getDescendantsRecursive(
    treeId: string,
    currentParentId: string,
    currentGeneration: number,
  ): Promise<any[]> {
    const childRelations = await this.prisma.parentChild.findMany({
      where: {
        tree_id: treeId,
        parent_id: currentParentId,
      },
      include: {
        child: true,
      },
    });

    if (childRelations.length === 0) return [];

    const childIds = childRelations.map((cr) => cr.child_id);
    const partnershipMap = await this.getPartnershipsForPersons(treeId, childIds);

    const result = [];
    for (const cr of childRelations) {
      const child = cr.child;
      const subChildren = await this.getDescendantsRecursive(
        treeId,
        child.id,
        currentGeneration + 1,
      );
      result.push({
        ...this.formatPerson(child),
        generation: -currentGeneration,
        relationType: cr.relation_type,
        unions: partnershipMap.get(child.id) || [],
        children: subChildren,
      });
    }
    return result;
  }

  // =========================================================================
  // GET COUSINS (Lazy load saat Paman/Bibi diklik)
  // =========================================================================

  async getCousins(treeId: string, pamanBibiId: string) {
    const auntUncle = await this.prisma.person.findUnique({
      where: { id: pamanBibiId },
    });
    if (!auntUncle || auntUncle.tree_id !== treeId) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        `Person (Paman/Bibi) dengan ID ${pamanBibiId} tidak ditemukan di pohon keluarga ini`,
        { pamanBibiId, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    const childrenRelations = await this.prisma.parentChild.findMany({
      where: {
        tree_id: treeId,
        parent_id: pamanBibiId,
      },
      include: {
        child: true,
      },
    });

    const childIds = childrenRelations.map((c) => c.child_id);
    const partnershipMap = await this.getPartnershipsForPersons(treeId, childIds);

    const cousins = childrenRelations.map((cr) => ({
      ...this.formatPerson(cr.child),
      relationType: cr.relation_type,
      parent: {
        id: auntUncle.id,
        name: `${auntUncle.first_name}${auntUncle.last_name ? ' ' + auntUncle.last_name : ''}`,
        role: auntUncle.gender === 'female' ? 'Bibi' : 'Paman',
      },
      unions: partnershipMap.get(cr.child_id) || [],
    }));

    return {
      pamanBibi: {
        id: auntUncle.id,
        name: `${auntUncle.first_name}${auntUncle.last_name ? ' ' + auntUncle.last_name : ''}`,
        role: auntUncle.gender === 'female' ? 'Bibi' : 'Paman',
      },
      cousinCount: cousins.length,
      cousins,
    };
  }

  // =========================================================================
  // RENDER GLOBAL FAMILY TREE (Fitur tersendiri untuk keseluruhan silsilah)
  // =========================================================================

  async renderTree(treeId: string, query: any) {
    const tree = await this.prisma.familyTree.findUnique({
      where: { id: treeId },
    });
    if (!tree) {
      throw new BusinessException(
        BusinessErrorCode.TREE_NOT_FOUND,
        `Tree dengan ID ${treeId} tidak ditemukan`,
        { treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    const rootId = query.rootId || tree.root_person_id;
    if (!rootId) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        `Tree ini belum memiliki root person untuk dirender`,
        { treeId },
        HttpStatus.BAD_REQUEST,
      );
    }

    const root = await this.prisma.person.findUnique({
      where: { id: rootId },
    });
    if (!root || root.tree_id !== treeId) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        `Root person dengan ID ${rootId} tidak ditemukan di tree ini`,
        { rootId, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    const format = query.format || 'hierarchy';
    const direction = query.direction || 'descendants';
    const maxDepth = Number(query.depth) || 5;

    if (format === 'graph') {
      return this.renderGraph(treeId, rootId, maxDepth, direction);
    } else {
      return this.renderHierarchy(treeId, root, maxDepth, direction);
    }
  }

  private async renderHierarchy(
    treeId: string,
    rootPerson: any,
    maxDepth: number,
    direction: string,
  ) {
    const buildNode = async (person: any, currentDepth: number): Promise<any> => {
      const pMap = await this.getPartnershipsForPersons(treeId, [person.id]);
      const node: any = {
        id: person.id,
        name: `${person.first_name}${person.last_name ? ' ' + person.last_name : ''}`,
        gender: person.gender,
        birthDate: person.birth_date,
        deathDate: person.death_date,
        isLiving: person.is_living,
        photoUrl: person.photo_url,
        generation: currentDepth,
        unions: pMap.get(person.id) || [],
        children: [],
      };

      if (currentDepth >= maxDepth) {
        node.hasMore = true;
        return node;
      }

      if (direction === 'descendants' || direction === 'all') {
        const relations = await this.prisma.parentChild.findMany({
          where: { tree_id: treeId, parent_id: person.id },
          include: { child: true },
        });

        for (const rel of relations) {
          const childNode = await buildNode(rel.child, currentDepth + 1);
          childNode.relationType = rel.relation_type;
          childNode.unionId = rel.partnership_id;
          node.children.push(childNode);
        }
      } else if (direction === 'ancestors') {
        const relations = await this.prisma.parentChild.findMany({
          where: { tree_id: treeId, child_id: person.id },
          include: { parent: true },
        });

        for (const rel of relations) {
          const parentNode = await buildNode(rel.parent, currentDepth + 1);
          parentNode.relationType = rel.relation_type;
          node.children.push(parentNode);
        }
      }

      return node;
    };

    const treeHierarchy = await buildNode(rootPerson, 0);

    return {
      meta: {
        treeId,
        rootId: rootPerson.id,
        direction,
        depth: maxDepth,
        format: 'hierarchy',
      },
      data: treeHierarchy,
    };
  }

  private async renderGraph(
    treeId: string,
    rootId: string,
    maxDepth: number,
    direction: string,
  ) {
    const visitedPersons = new Set<string>();
    const nodes: any[] = [];
    const links: any[] = [];

    const queue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
    visitedPersons.add(rootId);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const person = await this.prisma.person.findUnique({ where: { id } });
      if (person) {
        nodes.push(this.formatPerson(person));
      }

      if (depth >= maxDepth) continue;

      // Partnerships
      const partnerships = await this.prisma.partnership.findMany({
        where: {
          tree_id: treeId,
          OR: [{ person_a_id: id }, { person_b_id: id }],
        },
      });

      for (const p of partnerships) {
        const partnerId = p.person_a_id === id ? p.person_b_id : p.person_a_id;
        links.push({
          id: p.id,
          source: p.person_a_id,
          target: p.person_b_id,
          type: 'partnership',
          status: p.status,
        });

        if (!visitedPersons.has(partnerId)) {
          visitedPersons.add(partnerId);
          queue.push({ id: partnerId, depth });
        }
      }

      // Parent-Child relations
      if (direction === 'descendants' || direction === 'all') {
        const children = await this.prisma.parentChild.findMany({
          where: { tree_id: treeId, parent_id: id },
        });

        for (const c of children) {
          links.push({
            id: c.id,
            source: id,
            target: c.child_id,
            type: 'parent-child',
            relationType: c.relation_type,
          });

          if (!visitedPersons.has(c.child_id)) {
            visitedPersons.add(c.child_id);
            queue.push({ id: c.child_id, depth: depth + 1 });
          }
        }
      }

      if (direction === 'ancestors' || direction === 'all') {
        const parents = await this.prisma.parentChild.findMany({
          where: { tree_id: treeId, child_id: id },
        });

        for (const p of parents) {
          links.push({
            id: p.id,
            source: p.parent_id,
            target: id,
            type: 'parent-child',
            relationType: p.relation_type,
          });

          if (!visitedPersons.has(p.parent_id)) {
            visitedPersons.add(p.parent_id);
            queue.push({ id: p.parent_id, depth: depth + 1 });
          }
        }
      }
    }

    return {
      meta: {
        treeId,
        rootId,
        direction,
        depth: maxDepth,
        format: 'graph',
        totalNodes: nodes.length,
        totalLinks: links.length,
      },
      nodes,
      links,
    };
  }
}
