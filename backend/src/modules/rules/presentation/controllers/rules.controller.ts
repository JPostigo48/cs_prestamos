import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateRuleUseCase } from '../../application/use-cases/create-rule.use-case.js';
import { ListActiveRulesUseCase } from '../../application/use-cases/list-active-rules.use-case.js';
import { SetRuleStatusUseCase } from '../../application/use-cases/set-rule-status.use-case.js';
import { UpdateRuleUseCase } from '../../application/use-cases/update-rule.use-case.js';
import {
  CreateRuleDto,
  SetRuleStatusDto,
  UpdateRuleDto,
} from '../dto/rule.dto.js';

@Controller('rules')
export class RulesController {
  constructor(
    private readonly createRule: CreateRuleUseCase,
    private readonly updateRule: UpdateRuleUseCase,
    private readonly setRuleStatus: SetRuleStatusUseCase,
    private readonly listActiveRules: ListActiveRulesUseCase,
  ) {}

  @Post()
  create(@Body() input: CreateRuleDto) {
    return this.createRule.execute(input);
  }

  @Put(':ruleId')
  update(@Param('ruleId') ruleId: string, @Body() input: UpdateRuleDto) {
    return this.updateRule.execute({
      ruleId,
      title: input.title,
      description: input.description,
      penaltyPercentage: input.penaltyPercentage,
      consequence: input.consequence,
    });
  }

  @Patch(':ruleId/status')
  setStatus(@Param('ruleId') ruleId: string, @Body() input: SetRuleStatusDto) {
    return this.setRuleStatus.execute({ ruleId, status: input.status });
  }

  @Get('active')
  listActive() {
    return this.listActiveRules.execute();
  }
}
