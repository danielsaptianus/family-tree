import { Module } from '@nestjs/common';
import { TreesService } from './trees.service';
import { TreesController } from './controllers/v1/trees.controller';

@Module({
  controllers: [TreesController],
  providers: [TreesService],
  exports: [TreesService],
})
export class TreesModule {}
