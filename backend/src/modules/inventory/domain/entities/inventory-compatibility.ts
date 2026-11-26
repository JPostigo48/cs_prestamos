/** Capabilities are schema prerequisites, never authorization or per-row eligibility. */
export interface InventoryCompatibility {
  status: 'READY' | 'UPDATE_PENDING';
  message: string | null;
  capabilities: {
    physicalCondition: boolean;
    administrativeEnablement: boolean;
    verifiedAvailability: boolean;
  };
  actions: {
    descriptiveEdits: true;
    create: boolean;
    activate: boolean;
    release: boolean;
    rehabilitate: boolean;
    manageCopy: boolean;
  };
}
