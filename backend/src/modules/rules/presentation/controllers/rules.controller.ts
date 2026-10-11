import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags } from '@nestjs/swagger';
import { CreateRuleUseCase } from '../../application/use-cases/create-rule.use-case.js';
import { ListActiveRulesUseCase } from '../../application/use-cases/list-active-rules.use-case.js';
import { SetRuleStatusUseCase } from '../../application/use-cases/set-rule-status.use-case.js';
import { UpdateRuleUseCase } from '../../application/use-cases/update-rule.use-case.js';
import {
  CreateRuleDto,
  SetRuleStatusDto,
  UpdateRuleDto,
} from '../dto/rule.dto.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';

@ApiTags('Reglas y términos')
@Controller('rules')
@UseGuards(AuthGuard, RolesGuard)
@Roles(AccessRole.ADMINISTRATOR)
export class RulesController {
  constructor(
    private readonly createRule: CreateRuleUseCase,
    private readonly updateRule: UpdateRuleUseCase,
    private readonly setRuleStatus: SetRuleStatusUseCase,
    private readonly listActiveRules: ListActiveRulesUseCase,
  ) {}

  @Post()
  @ApiBody({ type: CreateRuleDto })
  @ApiOperation({ summary: 'Registrar regla de uso' })
  create(@Body() input: CreateRuleDto) {
    return this.createRule.execute(input);
  }

  @Put(':ruleId')
  @ApiBody({ type: UpdateRuleDto })
  @ApiOperation({ summary: 'Modificar regla de uso' })
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
  @ApiBody({ type: SetRuleStatusDto })
  @ApiOperation({ summary: 'Cambiar estado de una regla' })
  setStatus(@Param('ruleId') ruleId: string, @Body() input: SetRuleStatusDto) {
    return this.setRuleStatus.execute({ ruleId, status: input.status });
  }

  @Get('active')
  @ApiOperation({ summary: 'Consultar reglas vigentes' })
  listActive() {
    return this.listActiveRules.execute();
  }
}
