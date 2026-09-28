export interface JwtPayload {
  userId: number;
  email: string;
  positionId: number;
  positionName: string;
  permissions: string[];
  treeId?: string | null;
  personId?: string | null;
}
