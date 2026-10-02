import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { CreateParentChildDto } from './core/dto/create-parent-child.dto';
import { CreatePartnershipDto } from './core/dto/create-partnership.dto';
import { UpdatePartnershipDto } from './core/dto/update-partnership.dto';
import { BusinessException, BusinessErrorCode } from '@common/exceptions/business.exception';
import { Prisma } from '@prisma/client';

@Injectable()
export class RelationshipsService {
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

  // ============================================
  // PARENT-CHILD (FR-08, FR-09)
  // ============================================

  /**
   * BR-04: Deteksi Siklus berbasis Recursive CTE
   * Memeriksa apakah childId sudah merupakan leluhur (ancestor) dari parentId.
   */
  private async detectCycle(
    tx: Prisma.TransactionClient,
    treeId: string,
    parentId: string,
    childId: string,
  ): Promise<boolean> {
    const result = await tx.$queryRaw<Array<{ exists: number }>>`
      WITH RECURSIVE ancestors AS (
        SELECT parent_id FROM parent_child WHERE child_id = ${parentId}::uuid AND tree_id = ${treeId}::uuid
        UNION
        SELECT pc.parent_id
        FROM parent_child pc
        JOIN ancestors a ON pc.child_id = a.parent_id
        WHERE pc.tree_id = ${treeId}::uuid
      )
      SELECT 1 as "exists" FROM ancestors WHERE parent_id = ${childId}::uuid LIMIT 1;
    `;
    return result.length > 0;
  }

  private validateParentChildChronology(parent: any, child: any) {
    if (parent.birth_date && child.birth_date) {
      if (child.birth_date <= parent.birth_date) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_BIRTH_ORDER,
          `Tanggal lahir anak harus setelah tanggal lahir orang tua kandung (${parent.first_name})`,
          { parentBirthDate: parent.birth_date, childBirthDate: child.birth_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const minParentAgeMs = 12 * 365.25 * 24 * 60 * 60 * 1000;
      if (child.birth_date.getTime() - parent.birth_date.getTime() < minParentAgeMs) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_BIRTH_ORDER,
          `Usia orang tua kandung (${parent.first_name}) saat anak lahir minimal harus 12 tahun`,
          { parentBirthDate: parent.birth_date, childBirthDate: child.birth_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    if (parent.death_date && child.birth_date) {
      if (parent.gender === 'female' && child.birth_date > parent.death_date) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_DATES,
          `Anak kandung tidak dapat lahir setelah tanggal wafat ibu (${parent.first_name})`,
          { motherDeathDate: parent.death_date, childBirthDate: child.birth_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (parent.gender === 'male') {
        const maxPosthumousDaysMs = 300 * 24 * 60 * 60 * 1000;
        if (child.birth_date.getTime() - parent.death_date.getTime() > maxPosthumousDaysMs) {
          throw new BusinessException(
            BusinessErrorCode.INVALID_DATES,
            `Anak kandung tidak dapat lahir lebih dari 300 hari setelah tanggal wafat ayah (${parent.first_name})`,
            { fatherDeathDate: parent.death_date, childBirthDate: child.birth_date },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
    }
  }

  async createParentChild(treeId: string, dto: CreateParentChildDto) {
    await this.ensureTreeExists(treeId);

    // BR-01: Person tidak boleh menjadi orang tua dirinya sendiri
    if (dto.parentId === dto.childId) {
      throw new BusinessException(
        BusinessErrorCode.SELF_RELATION,
        'Person tidak boleh menjadi orang tua dirinya sendiri',
        { parentId: dto.parentId, childId: dto.childId },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // BR-12: Kunci sesi pohon keluarga menggunakan PostgreSQL Advisory Lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${treeId}))`;

      // BR-02: Semua person dalam satu relasi harus berada di tree yang sama
      const [parent, child] = await Promise.all([
        tx.person.findUnique({ where: { id: dto.parentId } }),
        tx.person.findUnique({ where: { id: dto.childId } }),
      ]);

      if (!parent) {
        throw new BusinessException(
          BusinessErrorCode.PERSON_NOT_FOUND,
          `Parent dengan ID ${dto.parentId} tidak ditemukan`,
          { parentId: dto.parentId },
          HttpStatus.NOT_FOUND,
        );
      }

      if (!child) {
        throw new BusinessException(
          BusinessErrorCode.PERSON_NOT_FOUND,
          `Child dengan ID ${dto.childId} tidak ditemukan`,
          { childId: dto.childId },
          HttpStatus.NOT_FOUND,
        );
      }

      if (parent.tree_id !== treeId || child.tree_id !== treeId) {
        throw new BusinessException(
          BusinessErrorCode.CROSS_TREE_RELATION,
          'Parent dan Child harus berada di dalam pohon silsilah (tree) yang sama',
          { treeId, parentTreeId: parent.tree_id, childTreeId: child.tree_id },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // BR-05: Satu pasangan parent–child hanya punya satu tipe relasi
      const existingRelation = await tx.parentChild.findUnique({
        where: {
          parent_id_child_id: {
            parent_id: dto.parentId,
            child_id: dto.childId,
          },
        },
      });

      if (existingRelation) {
        throw new BusinessException(
          BusinessErrorCode.DUPLICATE_RELATION,
          'Relasi antara parent dan child ini sudah ada',
          { parentId: dto.parentId, childId: dto.childId, existingType: existingRelation.relation_type },
          HttpStatus.CONFLICT,
        );
      }

      // BR-04: Deteksi Siklus (Cycle Detection via Recursive CTE)
      const hasCycle = await this.detectCycle(tx, treeId, dto.parentId, dto.childId);
      if (hasCycle) {
        throw new BusinessException(
          BusinessErrorCode.CYCLE_DETECTED,
          'Relasi ini akan membuat siklus: child adalah leluhur dari parent',
          { parentId: dto.parentId, childId: dto.childId },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // BR-09: Seseorang tidak boleh sekaligus orang tua dan pasangan dari orang yang sama
      const existingPartnership = await tx.partnership.findFirst({
        where: {
          tree_id: treeId,
          OR: [
            { person_a_id: dto.parentId, person_b_id: dto.childId },
            { person_a_id: dto.childId, person_b_id: dto.parentId },
          ],
        },
      });

      if (existingPartnership) {
        throw new BusinessException(
          BusinessErrorCode.CONFLICTING_RELATION,
          'Seseorang tidak boleh sekaligus menjadi orang tua dan pasangan dari orang yang sama',
          { parentId: dto.parentId, childId: dto.childId },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // BR-03: Maksimal 2 orang tua bertipe biological per person
      const relationType = dto.relationType ?? 'biological';
      if (relationType === 'biological') {
        const biologicalCount = await tx.parentChild.count({
          where: {
            child_id: dto.childId,
            relation_type: 'biological',
          },
        });

        if (biologicalCount >= 2) {
          throw new BusinessException(
            BusinessErrorCode.MAX_BIOLOGICAL_PARENTS,
            'Maksimal 2 orang tua bertipe biological per person',
            { childId: dto.childId, currentCount: biologicalCount },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        // BR-06 & BR-07: Kronologi tanggal lahir orang tua dan anak kandung
        this.validateParentChildChronology(parent, child);
      }

      // BR-08: end_date tidak boleh sebelum start_date
      let startDate: Date | undefined = dto.startDate ? new Date(dto.startDate) : undefined;
      let endDate: Date | undefined = dto.endDate ? new Date(dto.endDate) : undefined;

      if (startDate && endDate && endDate < startDate) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_DATES,
          'endDate tidak boleh sebelum startDate',
          { startDate: dto.startDate, endDate: dto.endDate },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      if (relationType === 'adopted' && startDate && child.birth_date && startDate < child.birth_date) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_DATES,
          'Tanggal mulai adopsi tidak boleh sebelum tanggal lahir anak',
          { startDate: dto.startDate, childBirthDate: child.birth_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // Validasi Union Asal (BR-13 & BR-14)
      let resolvedPartnershipId = dto.partnershipId;

      if (dto.partnershipId) {
        const union = await tx.partnership.findUnique({
          where: { id: dto.partnershipId },
        });

        if (!union || union.tree_id !== treeId) {
          throw new BusinessException(
            BusinessErrorCode.INVALID_UNION,
            `Partnership dengan ID ${dto.partnershipId} tidak ditemukan di tree ini`,
            { partnershipId: dto.partnershipId },
            HttpStatus.NOT_FOUND,
          );
        }

        // BR-13: partnership_id harus union yang salah satu anggotanya adalah parent tersebut
        if (union.person_a_id !== dto.parentId && union.person_b_id !== dto.parentId) {
          throw new BusinessException(
            BusinessErrorCode.INVALID_UNION,
            'Partnership yang dipilih harus melibatkan parent tersebut sebagai salah satu pasangan',
            { parentId: dto.parentId, partnershipId: dto.partnershipId },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        // BR-14: Jika anak punya dua orang tua biologis yang menautkan union, harus union yang sama
        if (relationType === 'biological') {
          const otherBioParent = await tx.parentChild.findFirst({
            where: {
              child_id: dto.childId,
              relation_type: 'biological',
              partnership_id: { not: null },
            },
          });

          if (otherBioParent && otherBioParent.partnership_id !== dto.partnershipId) {
            throw new BusinessException(
              BusinessErrorCode.INVALID_UNION,
              'Kedua orang tua biologis dari anak harus menunjuk ke union (pernikahan) yang sama',
              {
                childId: dto.childId,
                existingUnionId: otherBioParent.partnership_id,
                providedUnionId: dto.partnershipId,
              },
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
        }
      }

      // -----------------------------------------------------------------------
      // Otomatisasi Penghubungan Pasangan (Ayah & Ibu Sekaligus) untuk Biological
      // -----------------------------------------------------------------------
      if (relationType === 'biological' && dto.autoLinkPartner !== false) {
        let otherParentId: string | null = null;

        if (resolvedPartnershipId) {
          const union = await tx.partnership.findUnique({
            where: { id: resolvedPartnershipId },
          });
          if (union && (union.person_a_id === dto.parentId || union.person_b_id === dto.parentId)) {
            otherParentId = union.person_a_id === dto.parentId ? union.person_b_id : union.person_a_id;
          }
        } else {
          // Cari pernikahan aktif dari parentId jika partnershipId tidak diberikan secara manual
          const activePartnerships = await tx.partnership.findMany({
            where: {
              tree_id: treeId,
              OR: [{ person_a_id: dto.parentId }, { person_b_id: dto.parentId }],
              status: { in: ['married', 'partner'] },
              end_date: null,
            },
          });

          // Jika parent hanya memiliki tepat 1 pernikahan aktif, gunakan union tersebut
          if (activePartnerships.length === 1) {
            const activeUnion = activePartnerships[0];
            resolvedPartnershipId = activeUnion.id;
            otherParentId = activeUnion.person_a_id === dto.parentId ? activeUnion.person_b_id : activeUnion.person_a_id;
          }
        }

        // Jika pasangan ditemukan, periksa dan buat relasi untuk pasangan (otherParent)
        if (otherParentId) {
          const existingOtherRelation = await tx.parentChild.findUnique({
            where: {
              parent_id_child_id: {
                parent_id: otherParentId,
                child_id: dto.childId,
              },
            },
          });

          if (!existingOtherRelation) {
            const currentBioCount = await tx.parentChild.count({
              where: {
                child_id: dto.childId,
                relation_type: 'biological',
              },
            });

            // Hanya otomatis jika kuota 2 orang tua biological mencukupi
            if (currentBioCount <= 1) {
              const otherParent = await tx.person.findUnique({ where: { id: otherParentId } });
              if (otherParent && otherParent.tree_id === treeId) {
                // Deteksi siklus untuk otherParent
                const otherCycle = await this.detectCycle(tx, treeId, otherParentId, dto.childId);
                if (!otherCycle) {
                  // Validasi conflicting relation (bukan pasangan dari anak)
                  const conflicting = await tx.partnership.findFirst({
                    where: {
                      tree_id: treeId,
                      OR: [
                        { person_a_id: otherParentId, person_b_id: dto.childId },
                        { person_a_id: dto.childId, person_b_id: otherParentId },
                      ],
                    },
                  });

                  if (!conflicting) {
                    // Validasi kronologi untuk otherParent
                    this.validateParentChildChronology(otherParent, child);

                    // Buat relasi untuk otherParent
                    await tx.parentChild.create({
                      data: {
                        tree_id: treeId,
                        parent_id: otherParentId,
                        child_id: dto.childId,
                        relation_type: 'biological',
                        partnership_id: resolvedPartnershipId,
                      },
                    });
                  }
                }
              }
            }
          }
        }
      }

      return tx.parentChild.create({
        data: {
          tree_id: treeId,
          parent_id: dto.parentId,
          child_id: dto.childId,
          relation_type: relationType,
          partnership_id: resolvedPartnershipId,
          start_date: startDate,
          end_date: endDate,
        },
        include: {
          parent: {
            select: { id: true, first_name: true, last_name: true, gender: true },
          },
          child: {
            select: { id: true, first_name: true, last_name: true, gender: true },
          },
        },
      });
    });
  }

  async removeParentChild(treeId: string, id: string) {
    await this.ensureTreeExists(treeId);

    const existing = await this.prisma.parentChild.findFirst({
      where: { id, tree_id: treeId },
    });

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.RELATION_NOT_FOUND,
        `Relasi parent-child dengan ID ${id} tidak ditemukan`,
        { id, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.parentChild.delete({ where: { id } });
    return { id, deleted: true, message: 'Relasi orang tua–anak berhasil dihapus' };
  }

  // ============================================
  // PARTNERSHIPS (FR-10, FR-11)
  // ============================================

  async createPartnership(treeId: string, dto: CreatePartnershipDto) {
    const tree = await this.ensureTreeExists(treeId);

    // BR-01: Person tidak boleh menjadi pasangan dirinya sendiri
    if (dto.personAId === dto.personBId) {
      throw new BusinessException(
        BusinessErrorCode.SELF_RELATION,
        'Person tidak boleh menjadi pasangan dirinya sendiri',
        { personAId: dto.personAId, personBId: dto.personBId },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // BR-02: Semua person dalam satu relasi harus berada di tree yang sama
    const [personA, personB] = await Promise.all([
      this.prisma.person.findUnique({ where: { id: dto.personAId } }),
      this.prisma.person.findUnique({ where: { id: dto.personBId } }),
    ]);

    if (!personA || !personB) {
      throw new BusinessException(
        BusinessErrorCode.PERSON_NOT_FOUND,
        'Salah satu atau kedua person tidak ditemukan',
        { personAId: dto.personAId, personBId: dto.personBId },
        HttpStatus.NOT_FOUND,
      );
    }

    if (personA.tree_id !== treeId || personB.tree_id !== treeId) {
      throw new BusinessException(
        BusinessErrorCode.CROSS_TREE_RELATION,
        'Kedua pasangan harus berada di dalam pohon silsilah (tree) yang sama',
        { treeId, personATreeId: personA.tree_id, personBTreeId: personB.tree_id },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // BR-09: Seseorang tidak boleh sekaligus orang tua dan pasangan dari orang yang sama
    const existingParentChild = await this.prisma.parentChild.findFirst({
      where: {
        tree_id: treeId,
        OR: [
          { parent_id: dto.personAId, child_id: dto.personBId },
          { parent_id: dto.personBId, child_id: dto.personAId },
        ],
      },
    });

    if (existingParentChild) {
      throw new BusinessException(
        BusinessErrorCode.CONFLICTING_RELATION,
        'Seseorang tidak boleh sekaligus menjadi orang tua dan pasangan dari orang yang sama',
        { personAId: dto.personAId, personBId: dto.personBId },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // BR-08: end_date tidak boleh sebelum start_date
    let startDate: Date | undefined = dto.startDate ? new Date(dto.startDate) : undefined;
    let endDate: Date | undefined = dto.endDate ? new Date(dto.endDate) : undefined;

    if (startDate && endDate && endDate < startDate) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_DATES,
        'endDate tidak boleh sebelum startDate',
        { startDate: dto.startDate, endDate: dto.endDate },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Tanggal mulai pernikahan tidak boleh mendahului tanggal lahir salah satu pasangan
    if (startDate) {
      if (personA.birth_date && startDate < personA.birth_date) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_DATES,
          'Tanggal mulai pernikahan tidak boleh mendahului tanggal lahir person A',
          { startDate: dto.startDate, birthDateA: personA.birth_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (personB.birth_date && startDate < personB.birth_date) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_DATES,
          'Tanggal mulai pernikahan tidak boleh mendahului tanggal lahir person B',
          { startDate: dto.startDate, birthDateB: personB.birth_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // BR-15: start_date union tidak boleh setelah death_date salah satu pasangan
    if (startDate) {
      if (personA.death_date && startDate > personA.death_date) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_DATES,
          'Tanggal mulai pernikahan tidak boleh setelah tanggal wafat person A',
          { startDate: dto.startDate, deathDateA: personA.death_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (personB.death_date && startDate > personB.death_date) {
        throw new BusinessException(
          BusinessErrorCode.INVALID_DATES,
          'Tanggal mulai pernikahan tidak boleh setelah tanggal wafat person B',
          { startDate: dto.startDate, deathDateB: personB.death_date },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const status = dto.status ?? 'married';
    if (status === 'widowed' && !personA.death_date && !personB.death_date) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_DATES,
        'Status widowed hanya boleh dipilih jika salah satu pasangan sudah memiliki tanggal wafat',
        { personAId: dto.personAId, personBId: dto.personBId },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Urutkan ID: person_a_id < person_b_id agar memenuhi chk_partner_order dan GiST overlap detection
    const [sortedPersonAId, sortedPersonBId] = [dto.personAId, dto.personBId].sort();

    return this.prisma.$transaction(async (tx) => {
      // BR-12: Kunci sesi pohon keluarga menggunakan PostgreSQL Advisory Lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${treeId}))`;

      // BR-12: Jika allow_concurrent_partnerships = false, person tidak boleh punya dua union aktif sekaligus
      if (!tree.allow_concurrent_partnerships) {
        const activeStatuses = ['married', 'partner', 'separated'];
        const isNewActive = activeStatuses.includes(status) && !endDate;

        if (isNewActive) {
          const [activeA, activeB] = await Promise.all([
            tx.partnership.findFirst({
              where: {
                tree_id: treeId,
                OR: [{ person_a_id: dto.personAId }, { person_b_id: dto.personAId }],
                status: { in: ['married', 'partner', 'separated'] },
                end_date: null,
              },
            }),
            tx.partnership.findFirst({
              where: {
                tree_id: treeId,
                OR: [{ person_a_id: dto.personBId }, { person_b_id: dto.personBId }],
                status: { in: ['married', 'partner', 'separated'] },
                end_date: null,
              },
            }),
          ]);

          if (activeA || activeB) {
            throw new BusinessException(
              BusinessErrorCode.CONCURRENT_PARTNERSHIP,
              'Pohon silsilah ini melarang pernikahan aktif bersamaan (poligami dimatikan)',
              { conflictingPersonId: activeA ? dto.personAId : dto.personBId },
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
        }
      }

      try {
        return await tx.partnership.create({
          data: {
            tree_id: treeId,
            person_a_id: sortedPersonAId,
            person_b_id: sortedPersonBId,
            status,
            start_date: startDate,
            end_date: endDate,
            notes: dto.notes,
          },
          include: {
            person_a: {
              select: { id: true, first_name: true, last_name: true, gender: true },
            },
            person_b: {
              select: { id: true, first_name: true, last_name: true, gender: true },
            },
          },
        });
      } catch (error: any) {
        // Tangkap pelanggaran PostgreSQL exclusion constraint (ex_partnership_overlap)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError ||
          error.message?.includes('ex_partnership_overlap')
        ) {
          throw new BusinessException(
            BusinessErrorCode.OVERLAPPING_PARTNERSHIP,
            'Periode pernikahan untuk pasangan yang sama tidak boleh saling tumpang tindih',
            { personAId: dto.personAId, personBId: dto.personBId, startDate: dto.startDate, endDate: dto.endDate },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        throw error;
      }
    });
  }

  async updatePartnership(treeId: string, id: string, dto: UpdatePartnershipDto) {
    await this.ensureTreeExists(treeId);

    const existing = await this.prisma.partnership.findFirst({
      where: { id, tree_id: treeId },
    });

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.PARTNERSHIP_NOT_FOUND,
        `Partnership dengan ID ${id} tidak ditemukan`,
        { id, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    const startDateStr = dto.startDate !== undefined ? dto.startDate : existing.start_date?.toISOString().split('T')[0];
    const endDateStr = dto.endDate !== undefined ? dto.endDate : existing.end_date?.toISOString().split('T')[0];

    let startDate: Date | undefined = startDateStr ? new Date(startDateStr) : undefined;
    let endDate: Date | undefined = endDateStr ? new Date(endDateStr) : undefined;

    if (startDate && endDate && endDate < startDate) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_DATES,
        'endDate tidak boleh sebelum startDate',
        { startDate: startDateStr, endDate: endDateStr },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // BR-12: Kunci sesi pohon keluarga menggunakan PostgreSQL Advisory Lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${treeId}))`;

      try {
        return await tx.partnership.update({
          where: { id },
          data: {
            ...(dto.status !== undefined && { status: dto.status }),
            ...(dto.startDate !== undefined && { start_date: startDate }),
            ...(dto.endDate !== undefined && { end_date: endDate }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
          },
          include: {
            person_a: {
              select: { id: true, first_name: true, last_name: true, gender: true },
            },
            person_b: {
              select: { id: true, first_name: true, last_name: true, gender: true },
            },
          },
        });
      } catch (error: any) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError ||
          error.message?.includes('ex_partnership_overlap')
        ) {
          throw new BusinessException(
            BusinessErrorCode.OVERLAPPING_PARTNERSHIP,
            'Periode pernikahan untuk pasangan yang sama tidak boleh saling tumpang tindih',
            { id, startDate: dto.startDate, endDate: dto.endDate },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        throw error;
      }
    });
  }

  async removePartnership(treeId: string, id: string) {
    await this.ensureTreeExists(treeId);

    const existing = await this.prisma.partnership.findFirst({
      where: { id, tree_id: treeId },
    });

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.PARTNERSHIP_NOT_FOUND,
        `Partnership dengan ID ${id} tidak ditemukan`,
        { id, treeId },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.partnership.delete({ where: { id } });
    return { id, deleted: true, message: 'Relasi pasangan berhasil dihapus' };
  }
}
