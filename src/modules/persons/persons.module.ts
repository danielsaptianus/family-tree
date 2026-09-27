import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './controllers/v1/persons.controller';

@Module({
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],
})
export class PersonsModule {}
