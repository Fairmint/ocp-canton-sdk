/**
 * Base parameters required for all CapTable operations.
 *
 * All Add/Edit/Delete operations on OCF objects now go through the CapTable contract instead of individual entity
 * contracts.
 */
export interface CapTableOperationParams {
  /** The contract ID of the CapTable contract for this issuer */
  capTableContractId: string;
}

/**
 * Parameters for adding a new OCF object to the cap table. Extends base params with the specific data type for the
 * object.
 */
export interface AddToCapTableParams<TData> extends CapTableOperationParams {
  /** The OCF data for the object being created */
  data: TData;
}

/** Parameters for editing an existing OCF object in the cap table. */
export interface EditInCapTableParams<TData> extends CapTableOperationParams {
  /** The ID of the object to edit */
  id: string;
  /** The new OCF data for the object */
  data: TData;
}

/** Parameters for deleting an OCF object from the cap table. */
export interface DeleteFromCapTableParams extends CapTableOperationParams {
  /** The ID of the object to delete */
  id: string;
}
