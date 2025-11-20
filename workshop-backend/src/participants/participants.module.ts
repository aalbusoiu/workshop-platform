import { Module } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { ParticipantsRepository } from './participants.repository';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  /*  controllers: [ParticipantsController],
    * The participants module has no standalone HTTP endpoints yet; 
    * Join and leave actions still surface through the sessions controller, 
    * which now delegates the underlying work to ParticipantsService
    */
  providers: [ParticipantsService, ParticipantsRepository, PrismaService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
