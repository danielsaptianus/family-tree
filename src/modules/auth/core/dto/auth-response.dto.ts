import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    position: {
      id: number;
      name: string;
    };
    permissions: string[];
    tree_id?: string | null;
    person_id?: string | null;
  };
}
