import type { TenantRecord } from '../../types/domain';
import { badRequest } from '../../utils/errors';
import type { EstimateBody } from './estimator.schemas';

export interface EstimateResult {
  baseRatePerSqFt: number;
  materialMultiplier: number;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  currency: 'USD';
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Deterministic, side-effect free quotation. Rates come only from the resolved
 * tenant's matrix (never from the request), so one contractor's pricing can
 * never be used to quote for another.
 */
export function calculateEstimate(tenant: TenantRecord, input: EstimateBody): EstimateResult {
  const matrix = tenant.estimator_pricing_matrix;

  const baseRate = matrix.base_rates[input.projectType];
  if (baseRate === undefined) {
    const supported = Object.keys(matrix.base_rates).sort().join(', ');
    throw badRequest(
      `Unknown project type '${input.projectType}'. Supported project types: ${supported}.`,
    );
  }

  const materialMultiplier = matrix.material_multipliers[input.materialTier];
  if (materialMultiplier === undefined) {
    const supported = Object.keys(matrix.material_multipliers).sort().join(', ');
    throw badRequest(
      `Unknown material tier '${input.materialTier}'. Supported tiers: ${supported}.`,
    );
  }

  const estimatedCostLow = roundMoney(input.squareFootage * baseRate * materialMultiplier);
  const estimatedCostHigh = roundMoney(
    estimatedCostLow * (1 + matrix.contingency_percent / 100),
  );

  return {
    baseRatePerSqFt: baseRate,
    materialMultiplier,
    estimatedCostLow,
    estimatedCostHigh,
    currency: 'USD',
  };
}
