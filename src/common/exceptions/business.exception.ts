import { HttpException, HttpStatus } from '@nestjs/common';

export enum BusinessErrorCode {
  SELF_RELATION = 'SELF_RELATION',
  CROSS_TREE_RELATION = 'CROSS_TREE_RELATION',
  MAX_BIOLOGICAL_PARENTS = 'MAX_BIOLOGICAL_PARENTS',
  CYCLE_DETECTED = 'CYCLE_DETECTED',
  DUPLICATE_RELATION = 'DUPLICATE_RELATION',
  INVALID_BIRTH_ORDER = 'INVALID_BIRTH_ORDER',
  INVALID_DATES = 'INVALID_DATES',
  CONFLICTING_RELATION = 'CONFLICTING_RELATION',
  OVERLAPPING_PARTNERSHIP = 'OVERLAPPING_PARTNERSHIP',
  CONCURRENT_PARTNERSHIP = 'CONCURRENT_PARTNERSHIP',
  INVALID_UNION = 'INVALID_UNION',
  TREE_NOT_FOUND = 'TREE_NOT_FOUND',
  PERSON_NOT_FOUND = 'PERSON_NOT_FOUND',
  RELATION_NOT_FOUND = 'RELATION_NOT_FOUND',
  PARTNERSHIP_NOT_FOUND = 'PARTNERSHIP_NOT_FOUND',
  TREE_TOO_LARGE = 'TREE_TOO_LARGE',
}

export class BusinessException extends HttpException {
  public readonly code: BusinessErrorCode | string;
  public readonly details?: Record<string, any>;

  constructor(
    code: BusinessErrorCode | string,
    message: string,
    details?: Record<string, any>,
    statusCode: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super(
      {
        statusCode,
        code,
        message,
        details,
      },
      statusCode,
    );
    this.code = code;
    this.details = details;
  }
}
