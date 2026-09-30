import { Module } from '@nestjs/common';
import { TreesService } from './trees.service';
import { TreesController } from './controllers/v1/trees.controller';
import { TreeBuilderService } from './core/services/tree-builder.service';

@Module({
  controllers: [TreesController],
  providers: [TreesService, TreeBuilderService],
  exports: [TreesService, TreeBuilderService],
})
export class TreesModule {}

