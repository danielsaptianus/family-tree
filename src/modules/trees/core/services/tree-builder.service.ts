import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { BusinessException, BusinessErrorCode } from '@common/exceptions/business.exception';
import { RenderTreeQueryDto, RenderDirection, RenderFormat } from '../dto/render-tree-query.dto';

interface RawEdge {
  person_id: string;
  parent_id?: string | null;
  child_id?: string | null;
  relation_type?: string | null;
  partnership_id?: string | null;
  generation: number;
}

@Injectable()
export class TreeBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async render(treeId: string, query: RenderTreeQueryDto) {
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
        'Tree ini belum memiliki root person untuk dirender',
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

    const direction = query.direction || RenderDirection.DESCENDANTS;
    const format = query.format || RenderFormat.HIERARCHY;
    const maxDepth = Number(query.depth) || 5;
    const includePartners = query.includePartners ?? true;
    const includeStepChildren = query.includeStepChildren ?? false;

    // Parse relationTypes filter
    const allowedRelationTypes = (query.relationTypes || 'biological,adopted')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    // Parse unionStatuses filter if provided
    const allowedUnionStatuses = query.unionStatuses
      ? query.unionStatuses.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    // -----------------------------------------------------------------------
    // QUERY 1: Recursive CTE (Descendants atau Ancestors)
    // -----------------------------------------------------------------------
    let edges: RawEdge[] = [];
    if (direction === RenderDirection.DESCENDANTS || direction === RenderDirection.ALL) {
      edges = await this.prisma.$queryRaw<RawEdge[]>`
        WITH RECURSIVE descendants AS (
          SELECT p.id AS person_id, NULL::uuid AS parent_id,
                 NULL::text AS relation_type,
                 NULL::uuid AS partnership_id,
                 0 AS generation, ARRAY[p.id] AS path
          FROM persons p
          WHERE p.id = ${rootId}::uuid AND p.tree_id = ${treeId}::uuid

          UNION ALL

          SELECT pc.child_id AS person_id, pc.parent_id, pc.relation_type::text, pc.partnership_id,
                 d.generation + 1, d.path || pc.child_id
          FROM parent_child pc
          JOIN descendants d ON pc.parent_id = d.person_id
          WHERE d.generation < ${maxDepth}
            AND pc.relation_type::text = ANY(${allowedRelationTypes})
            AND NOT (pc.child_id = ANY(d.path))
        )
        SELECT person_id, parent_id, relation_type, partnership_id,
               MIN(generation)::int AS generation
        FROM descendants
        GROUP BY person_id, parent_id, relation_type, partnership_id
        ORDER BY generation ASC;
      `;
    } else if (direction === RenderDirection.ANCESTORS) {
      edges = await this.prisma.$queryRaw<RawEdge[]>`
        WITH RECURSIVE ancestors AS (
          SELECT p.id AS person_id, NULL::uuid AS child_id,
                 NULL::text AS relation_type,
                 NULL::uuid AS partnership_id,
                 0 AS generation, ARRAY[p.id] AS path
          FROM persons p
          WHERE p.id = ${rootId}::uuid AND p.tree_id = ${treeId}::uuid

          UNION ALL

          SELECT pc.parent_id AS person_id, pc.child_id, pc.relation_type::text, pc.partnership_id,
                 a.generation + 1, a.path || pc.parent_id
          FROM parent_child pc
          JOIN ancestors a ON pc.child_id = a.person_id
          WHERE a.generation < ${maxDepth}
            AND pc.relation_type::text = ANY(${allowedRelationTypes})
            AND NOT (pc.parent_id = ANY(a.path))
        )
        SELECT person_id, child_id, relation_type, partnership_id,
               MIN(generation)::int AS generation
        FROM ancestors
        GROUP BY person_id, child_id, relation_type, partnership_id
        ORDER BY generation ASC;
      `;
    }

    // Kumpulkan person IDs yang terlibat
    const personIdsSet = new Set<string>([rootId]);
    for (const e of edges) {
      if (e.person_id) personIdsSet.add(e.person_id);
      if (e.parent_id) personIdsSet.add(e.parent_id);
      if (e.child_id) personIdsSet.add(e.child_id);
    }
    const initialPersonIds = Array.from(personIdsSet);

    // -----------------------------------------------------------------------
    // QUERY 2: Batch Query Persons & Partnerships (WHERE id = ANY(...))
    // -----------------------------------------------------------------------
    const [personsList, rawPartnerships] = await Promise.all([
      this.prisma.person.findMany({
        where: { id: { in: initialPersonIds }, tree_id: treeId },
      }),
      includePartners
        ? this.prisma.partnership.findMany({
            where: {
              tree_id: treeId,
              OR: [
                { person_a_id: { in: initialPersonIds } },
                { person_b_id: { in: initialPersonIds } },
              ],
            },
            include: {
              person_a: true,
              person_b: true,
            },
            orderBy: [{ start_date: 'asc' }],
          })
        : [],
    ]);

    // Tambahkan partner yang belum ada di personsList ke data map
    const personMap = new Map<string, any>();
    for (const p of personsList) {
      personMap.set(p.id, p);
    }
    for (const pship of rawPartnerships) {
      if (!personMap.has(pship.person_a_id)) personMap.set(pship.person_a_id, pship.person_a);
      if (!personMap.has(pship.person_b_id)) personMap.set(pship.person_b_id, pship.person_b);
    }

    // Susun mapping unions per person
    // Filter unionStatuses jika ditentukan
    const unionsPerPerson = new Map<string, any[]>();
    for (const pship of rawPartnerships) {
      if (allowedUnionStatuses && !allowedUnionStatuses.includes(pship.status)) {
        continue;
      }

      // Untuk Person A
      const partnerOfA = personMap.get(pship.person_b_id);
      const isCurrentA =
        ['married', 'partner', 'separated'].includes(pship.status) &&
        !pship.end_date &&
        (pship.person_a?.is_living ?? true) &&
        (partnerOfA?.is_living ?? true);

      const unionForA = {
        partnershipId: pship.id,
        partner: partnerOfA
          ? {
              id: partnerOfA.id,
              name: `${partnerOfA.first_name}${partnerOfA.last_name ? ' ' + partnerOfA.last_name : ''}`,
              gender: partnerOfA.gender,
              isLiving: partnerOfA.is_living,
            }
          : null,
        status: pship.status,
        startDate: pship.start_date ? pship.start_date.toISOString().split('T')[0] : null,
        endDate: pship.end_date ? pship.end_date.toISOString().split('T')[0] : null,
        isCurrent: isCurrentA,
      };
      if (!unionsPerPerson.has(pship.person_a_id)) unionsPerPerson.set(pship.person_a_id, []);
      unionsPerPerson.get(pship.person_a_id)!.push(unionForA);

      // Untuk Person B
      const partnerOfB = personMap.get(pship.person_a_id);
      const isCurrentB =
        ['married', 'partner', 'separated'].includes(pship.status) &&
        !pship.end_date &&
        (pship.person_b?.is_living ?? true) &&
        (partnerOfB?.is_living ?? true);

      const unionForB = {
        partnershipId: pship.id,
        partner: partnerOfB
          ? {
              id: partnerOfB.id,
              name: `${partnerOfB.first_name}${partnerOfB.last_name ? ' ' + partnerOfB.last_name : ''}`,
              gender: partnerOfB.gender,
              isLiving: partnerOfB.is_living,
            }
          : null,
        status: pship.status,
        startDate: pship.start_date ? pship.start_date.toISOString().split('T')[0] : null,
        endDate: pship.end_date ? pship.end_date.toISOString().split('T')[0] : null,
        isCurrent: isCurrentB,
      };
      if (!unionsPerPerson.has(pship.person_b_id)) unionsPerPerson.set(pship.person_b_id, []);
      unionsPerPerson.get(pship.person_b_id)!.push(unionForB);
    }

    // Urutkan union per node berdasarkan start_date (null di akhir), lalu berikan order 1, 2, ...
    for (const [pId, uList] of unionsPerPerson.entries()) {
      uList.sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return a.startDate.localeCompare(b.startDate);
      });
      uList.forEach((u, idx) => {
        u.order = idx + 1;
      });
    }

    // -----------------------------------------------------------------------
    // QUERY 3 (Opsional): Stepchildren Query
    // -----------------------------------------------------------------------
    let stepChildrenEdges: Array<{ node_id: string; child_id: string; partnership_id: string; other_parent_id: string }> = [];
    if (includeStepChildren && direction === RenderDirection.DESCENDANTS && initialPersonIds.length > 0) {
      stepChildrenEdges = await this.prisma.$queryRaw<any[]>`
        SELECT u.id AS partnership_id,
               CASE WHEN u.person_a_id = any_parent.parent_id THEN u.person_b_id ELSE u.person_a_id END AS other_parent_id,
               any_parent.parent_id AS node_id,
               pc.child_id
        FROM partnerships u
        JOIN (SELECT unnest(${initialPersonIds}::uuid[]) AS parent_id) any_parent
          ON (u.person_a_id = any_parent.parent_id OR u.person_b_id = any_parent.parent_id)
        JOIN parent_child pc
          ON pc.parent_id = CASE WHEN u.person_a_id = any_parent.parent_id THEN u.person_b_id ELSE u.person_a_id END
        WHERE u.tree_id = ${treeId}::uuid
          AND pc.relation_type::text = ANY(${allowedRelationTypes})
          AND NOT EXISTS (
            SELECT 1 FROM parent_child own
            WHERE own.parent_id = any_parent.parent_id AND own.child_id = pc.child_id
          );
      `;

      // Ambil person data untuk anak tiri yang belum ada di map
      const stepChildIds = stepChildrenEdges.map((s) => s.child_id);
      if (stepChildIds.length > 0) {
        const stepPersons = await this.prisma.person.findMany({
          where: { id: { in: stepChildIds }, tree_id: treeId },
        });
        for (const sp of stepPersons) {
          if (!personMap.has(sp.id)) personMap.set(sp.id, sp);
        }
      }
    }

    // -----------------------------------------------------------------------
    // QUERY 4: Batch hasMore Check pada Batas MaxDepth
    // -----------------------------------------------------------------------
    const boundaryNodeIds = edges
      .filter((e) => e.generation === maxDepth)
      .map((e) => e.person_id);

    const hasMoreSet = new Set<string>();
    if (boundaryNodeIds.length > 0) {
      if (direction === RenderDirection.DESCENDANTS || direction === RenderDirection.ALL) {
        const nextChildren = await this.prisma.$queryRaw<Array<{ parent_id: string }>>`
          SELECT DISTINCT parent_id
          FROM parent_child
          WHERE parent_id = ANY(${boundaryNodeIds}::uuid[])
            AND relation_type::text = ANY(${allowedRelationTypes});
        `;
        for (const r of nextChildren) hasMoreSet.add(r.parent_id);
      } else if (direction === RenderDirection.ANCESTORS) {
        const nextParents = await this.prisma.$queryRaw<Array<{ child_id: string }>>`
          SELECT DISTINCT child_id
          FROM parent_child
          WHERE child_id = ANY(${boundaryNodeIds}::uuid[])
            AND relation_type::text = ANY(${allowedRelationTypes});
        `;
        for (const r of nextParents) hasMoreSet.add(r.child_id);
      }
    }

    // -----------------------------------------------------------------------
    // FORMATTING: GRAPH vs HIERARCHY
    // -----------------------------------------------------------------------
    if (format === RenderFormat.GRAPH) {
      return this.buildGraphFormat(
        treeId,
        rootId,
        edges,
        personMap,
        rawPartnerships,
        unionsPerPerson,
        stepChildrenEdges,
      );
    } else {
      return this.buildHierarchyFormat(
        treeId,
        rootId,
        direction,
        maxDepth,
        edges,
        personMap,
        unionsPerPerson,
        stepChildrenEdges,
        hasMoreSet,
      );
    }
  }

  // =========================================================================
  // 8.2 In-Memory Assembly: HIERARCHY FORMAT
  // =========================================================================
  private buildHierarchyFormat(
    treeId: string,
    rootId: string,
    direction: RenderDirection,
    maxDepth: number,
    edges: RawEdge[],
    personMap: Map<string, any>,
    unionsPerPerson: Map<string, any[]>,
    stepChildrenEdges: any[],
    hasMoreSet: Set<string>,
  ) {
    // Bangun relasi mapping: parentId -> array of child edges
    const childrenMap = new Map<string, any[]>();
    for (const e of edges) {
      if (direction === RenderDirection.ANCESTORS) {
        // Pada ancestors, child_id adalah parent di hierarki visual (membalik orientasi)
        if (e.child_id) {
          if (!childrenMap.has(e.child_id)) childrenMap.set(e.child_id, []);
          childrenMap.get(e.child_id)!.push({
            childId: e.person_id,
            relationType: e.relation_type,
            unionId: e.partnership_id,
            generation: e.generation,
            isDerived: false,
          });
        }
      } else {
        if (e.parent_id) {
          if (!childrenMap.has(e.parent_id)) childrenMap.set(e.parent_id, []);
          childrenMap.get(e.parent_id)!.push({
            childId: e.person_id,
            relationType: e.relation_type,
            unionId: e.partnership_id,
            generation: e.generation,
            isDerived: false,
          });
        }
      }
    }

    // Tambahkan stepchildren ke childrenMap jika ada
    for (const sc of stepChildrenEdges) {
      if (!childrenMap.has(sc.node_id)) childrenMap.set(sc.node_id, []);
      childrenMap.get(sc.node_id)!.push({
        childId: sc.child_id,
        relationType: 'step',
        unionId: sc.partnership_id,
        otherParentId: sc.other_parent_id,
        generation: 1, // Keturunan langsung dari pasangan
        isDerived: true,
      });
    }

    // DFS Traverser
    const visitedNodes = new Set<string>();
    let totalNodeCount = 0;

    const traverse = (
      personId: string,
      currentGen: number,
      relationType: string | null = null,
      unionId: string | null = null,
      otherParentId: string | null = null,
      isDerived: boolean = false,
    ): any => {
      totalNodeCount++;
      const p = personMap.get(personId);
      const unions = unionsPerPerson.get(personId) || [];

      // Resolusi otherParentId jika belum ada dan unionId ada
      let resolvedOtherParentId = otherParentId;
      if (!resolvedOtherParentId && unionId) {
        const u = unions.find((un) => un.partnershipId === unionId);
        if (u && u.partner) {
          resolvedOtherParentId = u.partner.id;
        }
      }

      // Deteksi Duplikasi (isDuplicate: true jika sudah pernah dikunjungi di cabang lain)
      if (visitedNodes.has(personId)) {
        return {
          id: personId,
          name: p ? `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}` : 'Unknown',
          gender: p?.gender || 'unknown',
          birthDate: p?.birth_date ? p.birth_date.toISOString().split('T')[0] : null,
          deathDate: p?.death_date ? p.death_date.toISOString().split('T')[0] : null,
          isLiving: p?.is_living ?? true,
          photoUrl: p?.photo_url || null,
          generation: currentGen,
          unions: [],
          unionId,
          otherParentId: resolvedOtherParentId,
          relationType,
          isDerived,
          isDuplicate: true,
          hasMore: false,
          children: [],
        };
      }
      visitedNodes.add(personId);

      const node: any = {
        id: personId,
        name: p ? `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}` : 'Unknown',
        gender: p?.gender || 'unknown',
        birthDate: p?.birth_date ? p.birth_date.toISOString().split('T')[0] : null,
        deathDate: p?.death_date ? p.death_date.toISOString().split('T')[0] : null,
        isLiving: p?.is_living ?? true,
        photoUrl: p?.photo_url || null,
        generation: currentGen,
        unions,
        unionId,
        otherParentId: resolvedOtherParentId,
        relationType,
        isDerived,
        isDuplicate: false,
        hasMore: hasMoreSet.has(personId),
        children: [],
      };

      // Jangan telusuri anak dari anak tiri (SRS 8.2 butir 6)
      if (isDerived) {
        return node;
      }

      // Ambil anak-anak dari node ini
      const rawChildren = childrenMap.get(personId) || [];

      // Filter: anak yang sama dari kedua orang tua di union yang sama cukup muncul sekali
      const uniqueChildEdges = new Map<string, any>();
      for (const ce of rawChildren) {
        if (!uniqueChildEdges.has(ce.childId)) {
          uniqueChildEdges.set(ce.childId, ce);
        }
      }

      const childEdgeList = Array.from(uniqueChildEdges.values());

      // Urutkan anak (SRS 8.2 butir 9):
      // 1. Mengikuti order union
      // 2. birth_date (null di akhir)
      // 3. nama
      childEdgeList.sort((a, b) => {
        const uA = unions.find((un) => un.partnershipId === a.unionId);
        const uB = unions.find((un) => un.partnershipId === b.unionId);
        const orderA = uA ? uA.order : 999;
        const orderB = uB ? uB.order : 999;
        if (orderA !== orderB) return orderA - orderB;

        const pA = personMap.get(a.childId);
        const pB = personMap.get(b.childId);
        const dateA = pA?.birth_date ? pA.birth_date.toISOString() : null;
        const dateB = pB?.birth_date ? pB.birth_date.toISOString() : null;

        if (!dateA && !dateB) {
          const nameA = pA?.first_name || '';
          const nameB = pB?.first_name || '';
          return nameA.localeCompare(nameB);
        }
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB);
      });

      for (const ce of childEdgeList) {
        const childNode = traverse(
          ce.childId,
          currentGen + 1,
          ce.relationType,
          ce.unionId,
          ce.otherParentId || null,
          ce.isDerived || false,
        );
        node.children.push(childNode);
      }

      return node;
    };

    const treeData = traverse(rootId, 0);

    return {
      meta: {
        treeId,
        rootId,
        direction,
        depth: maxDepth,
        nodeCount: totalNodeCount,
        generatedAt: new Date().toISOString(),
      },
      data: treeData,
    };
  }

  // =========================================================================
  // 8.2 In-Memory Assembly: GRAPH FORMAT (Nodes & Links)
  // =========================================================================
  private buildGraphFormat(
    treeId: string,
    rootId: string,
    edges: RawEdge[],
    personMap: Map<string, any>,
    partnerships: any[],
    unionsPerPerson: Map<string, any[]>,
    stepChildrenEdges: any[],
  ) {
    const nodes: any[] = [];
    const links: any[] = [];
    const nodeIds = new Set<string>();

    // Map generation
    const genMap = new Map<string, number>();
    genMap.set(rootId, 0);
    for (const e of edges) {
      if (!genMap.has(e.person_id)) genMap.set(e.person_id, e.generation);
    }

    // Bangun Nodes
    for (const [pId, p] of personMap.entries()) {
      if (nodeIds.has(pId)) continue;
      nodeIds.add(pId);

      nodes.push({
        id: p.id,
        name: `${p.first_name}${p.last_name ? ' ' + p.last_name : ''}`,
        gender: p.gender,
        generation: genMap.get(p.id) ?? 0,
        birthDate: p.birth_date ? p.birth_date.toISOString().split('T')[0] : null,
        deathDate: p.death_date ? p.death_date.toISOString().split('T')[0] : null,
        isLiving: p.is_living,
        photoUrl: p.photo_url || null,
      });
    }

    // Bangun Links: Partnerships
    const processedPartnerships = new Set<string>();
    for (const pship of partnerships) {
      if (processedPartnerships.has(pship.id)) continue;
      if (nodeIds.has(pship.person_a_id) && nodeIds.has(pship.person_b_id)) {
        processedPartnerships.add(pship.id);
        const unionsOfA = unionsPerPerson.get(pship.person_a_id) || [];
        const u = unionsOfA.find((un) => un.partnershipId === pship.id);

        links.push({
          source: pship.person_a_id,
          target: pship.person_b_id,
          type: 'partnership',
          partnershipId: pship.id,
          status: pship.status,
          order: u?.order || 1,
        });
      }
    }

    // Bangun Links: Parent-Child
    const processedParentChild = new Set<string>();
    for (const e of edges) {
      if (e.parent_id && e.person_id) {
        const linkKey = `${e.parent_id}_${e.person_id}`;
        if (!processedParentChild.has(linkKey) && nodeIds.has(e.parent_id) && nodeIds.has(e.person_id)) {
          processedParentChild.add(linkKey);
          links.push({
            source: e.parent_id,
            target: e.person_id,
            type: 'parent-child',
            relationType: e.relation_type || 'biological',
            unionId: e.partnership_id || null,
          });
        }
      }
      if (e.child_id && e.person_id) {
        const linkKey = `${e.person_id}_${e.child_id}`;
        if (!processedParentChild.has(linkKey) && nodeIds.has(e.person_id) && nodeIds.has(e.child_id)) {
          processedParentChild.add(linkKey);
          links.push({
            source: e.person_id,
            target: e.child_id,
            type: 'parent-child',
            relationType: e.relation_type || 'biological',
            unionId: e.partnership_id || null,
          });
        }
      }
    }

    return {
      meta: {
        treeId,
        rootId,
        nodeCount: nodes.length,
        linkCount: links.length,
        generatedAt: new Date().toISOString(),
      },
      nodes,
      links,
    };
  }
}
